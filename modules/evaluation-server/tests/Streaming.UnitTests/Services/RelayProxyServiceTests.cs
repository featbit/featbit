using Domain.Shared;
using Infrastructure.Fakes;
using Infrastructure.Persistence;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Streaming.Services;

namespace Streaming.UnitTests.Services;

public class RelayProxyServiceTests
{
    private static IConfiguration BuildConfiguration(string providerName) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["DbProvider"] = providerName
            })
            .Build();

    private static RelayProxyService CreateService(string providerName)
    {
        var configuration = BuildConfiguration(providerName);
        var serviceProvider = new ServiceCollection().BuildServiceProvider();
        return new RelayProxyService(configuration, serviceProvider);
    }

    [Fact]
    public async Task GetSecretsAsync_FakeProviderWithKnownKey_ReturnsRpSecrets()
    {
        var service = CreateService(DbProvider.Fake);

        var secrets = await service.GetSecretsAsync(FakeSeedData.RelayProxyTokenString);

        Assert.Equal(2, secrets.Length);
        Assert.Contains(secrets, s => s.Type == SecretTypes.Server);
        Assert.Contains(secrets, s => s.Type == SecretTypes.Client);
    }

    [Fact]
    public async Task GetSecretsAsync_FakeProviderWithUnknownKey_ReturnsEmpty()
    {
        var service = CreateService(DbProvider.Fake);

        var secrets = await service.GetSecretsAsync("not-a-real-key");

        Assert.Empty(secrets);
    }

    [Fact]
    public async Task GetSecretsAsync_UnknownProvider_ReturnsEmpty()
    {
        var service = CreateService("Bogus");

        var secrets = await service.GetSecretsAsync(FakeSeedData.RelayProxyTokenString);

        Assert.Empty(secrets);
    }

    [Fact]
    public async Task GetServerSecretsAsync_FakeProvider_ReturnsOnlyServerTypeSecrets()
    {
        var service = CreateService(DbProvider.Fake);

        var secrets = await service.GetServerSecretsAsync(FakeSeedData.RelayProxyTokenString);

        Assert.NotEmpty(secrets);
        Assert.All(secrets, s => Assert.Equal(SecretTypes.Server, s.Type));
    }

    [Fact]
    public async Task GetServerSecretsAsync_UnknownProvider_ReturnsEmpty()
    {
        var service = CreateService("Bogus");

        var secrets = await service.GetServerSecretsAsync(FakeSeedData.RelayProxyTokenString);

        Assert.Empty(secrets);
    }

    [Fact]
    public async Task UpdateAgentStatusAsync_UnsupportedProvider_NoOps()
    {
        // Mongo/Postgres branches require real DB connections and are covered by integration tests.
        // The Fake/unknown provider branches should silently succeed without throwing.
        var service = CreateService(DbProvider.Fake);

        var ex = await Record.ExceptionAsync(() =>
            service.UpdateAgentStatusAsync("any-key", "agent-1", "online"));

        Assert.Null(ex);
    }
}
