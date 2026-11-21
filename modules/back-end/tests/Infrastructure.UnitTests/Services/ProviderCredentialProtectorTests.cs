using System.Security.Cryptography;
using Application.Bases.Exceptions;
using Application.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Infrastructure.UnitTests.Services;

public class ProviderCredentialProtectorTests
{
    [Fact]
    public void RotationUsesTheActiveKeyAndCanStillReadThePreviousKey()
    {
        var settings = new ConfigurationBuilder().AddInMemoryCollection().Build();
        settings["ReleaseHealth:Credentials:ActiveKeyId"] = "old";
        settings["ReleaseHealth:Credentials:Keys:old"] = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        using var services = new ServiceCollection().AddProviderCredentials(settings).BuildServiceProvider();
        var protector = services.GetRequiredService<IProviderCredentialProtector>();
        var original = protector.Protect("test-secret", "first connection");

        settings["ReleaseHealth:Credentials:ActiveKeyId"] = "new";
        var newKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        settings["ReleaseHealth:Credentials:Keys:new"] = newKey;
        settings.Reload();
        var rotated = protector.Protect("test-secret", "first connection");
        Assert.NotEqual(original, rotated);
        Assert.Equal("test-secret", protector.Unprotect(original, "first connection"));
        Assert.Throws<BusinessException>(() => protector.Unprotect(original, "another connection"));
        var newSettings = new ConfigurationBuilder().AddInMemoryCollection().Build();
        newSettings["ReleaseHealth:Credentials:ActiveKeyId"] = "new";
        newSettings["ReleaseHealth:Credentials:Keys:new"] = newKey;
        using var newServices = new ServiceCollection().AddProviderCredentials(newSettings).BuildServiceProvider();
        var retired = newServices.GetRequiredService<IProviderCredentialProtector>();
        Assert.Throws<BusinessException>(() => retired.Unprotect(original, "first connection"));
        Assert.Equal("test-secret", retired.Unprotect(rotated, "first connection"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("not a base64 key")]
    [InlineData("AQID")]
    public async Task InvalidKeyRingFailsAtStartup(string? encodedKey)
    {
        var settings = new ConfigurationBuilder().AddInMemoryCollection().Build();
        settings["ReleaseHealth:Credentials:ActiveKeyId"] = "test";
        if (encodedKey != null) settings["ReleaseHealth:Credentials:Keys:test"] = encodedKey;
        using var host = new HostBuilder()
            .ConfigureServices(services => services.AddProviderCredentials(settings))
            .Build();
        await Assert.ThrowsAsync<OptionsValidationException>(() => host.StartAsync());
    }

    [Fact]
    public async Task AbsentKeyRingAllowsStartupAndRefusesAuthenticatedWrites()
    {
        var settings = new ConfigurationBuilder().AddInMemoryCollection().Build();
        using var host = new HostBuilder()
            .ConfigureServices(services => services.AddProviderCredentials(settings))
            .Build();
        await host.StartAsync();
        var protector = host.Services.GetRequiredService<IProviderCredentialProtector>();
        var error = Assert.Throws<BusinessException>(() => protector.Protect("test-secret", "connection"));
        Assert.Equal("provider_credential_key_unavailable", error.Message);
        await host.StopAsync();
    }
}
