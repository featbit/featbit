using System.Security.Cryptography;
using System.Text.Json;
using Application.Bases.Exceptions;
using Application.ObservabilityProviders;
using Application.Services;
using Domain.ObservabilityProviders;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Infrastructure.UnitTests.Services;

public class ProviderConfigurationTests : IDisposable
{
    private readonly Guid _envId = Guid.NewGuid();
    private readonly Guid _id = Guid.NewGuid();
    private readonly ServiceProvider _services;
    private readonly IProviderCredentialProtector _protector;

    public ProviderConfigurationTests()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection().Build();
        config["ReleaseHealth:Credentials:ActiveKeyId"] = "test";
        config["ReleaseHealth:Credentials:Keys:test"] = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        _services = new ServiceCollection().AddProviderCredentials(config).BuildServiceProvider();
        _protector = _services.GetRequiredService<IProviderCredentialProtector>();
    }

    public void Dispose() => _services.Dispose();

    [Fact]
    public void AzureClientSecretIsWriteOnlyAndCannotBeKeptForAnotherApplication()
    {
        var request = new ObservabilityProviderRequest
        {
            ProviderType = ProviderConfiguration.AzureMonitor,
            ProviderConfig = JsonSerializer.SerializeToElement(new { workspaceId = Guid.NewGuid() }),
            Authentication = JsonSerializer.SerializeToElement(new { mode = "ClientSecret", tenantId = Guid.NewGuid(), clientId = Guid.NewGuid() }),
            SecretUpdate = JsonSerializer.SerializeToElement(new { operation = "replace", clientSecret = "test-only-client-secret" })
        };
        var created = Prepare(request);
        var output = JsonSerializer.Serialize(created.ConnectionConfiguration);
        Assert.DoesNotContain("test-only-client-secret", output);
        Assert.DoesNotContain("test-only-client-secret", created.ProtectedCredential);
        Assert.Equal("configured", created.ConnectionConfiguration.Authentication.GetProperty("secretState").GetString());

        request.SecretUpdate = JsonSerializer.SerializeToElement(new { operation = "keep" });
        var previous = Previous(request, created);
        var kept = Prepare(request, previous);
        Assert.True(JsonElement.DeepEquals(created.ConnectionConfiguration.Authentication, kept.ConnectionConfiguration.Authentication));
        request.Authentication = JsonSerializer.SerializeToElement(new { mode = "ClientSecret", tenantId = Guid.NewGuid(), clientId = Guid.NewGuid() });
        Assert.Throws<BusinessException>(() => Prepare(request, previous));
    }

    [Fact]
    public void PrometheusKeepPreservesRotationTimeAndSwitchingToNoneRevokesSecret()
    {
        var request = BasicRequest();
        var created = Prepare(request);
        var previous = Previous(request, created);
        var read = created.ConnectionConfiguration.Authentication;
        Assert.Equal("reader", read.GetProperty("username").GetString());
        Assert.False(read.TryGetProperty("password", out _));

        request.SecretUpdate = JsonSerializer.SerializeToElement(new { operation = "keep" });
        var kept = Prepare(request, previous);
        Assert.True(JsonElement.DeepEquals(read, kept.ConnectionConfiguration.Authentication));
        request.Authentication = JsonSerializer.SerializeToElement(new { type = "bearer_token" });
        Assert.Throws<BusinessException>(() => Prepare(request, previous));
        request.Authentication = JsonSerializer.SerializeToElement(new { type = "none" });
        request.SecretUpdate = JsonSerializer.SerializeToElement(new { operation = "remove" });
        var removed = Prepare(request, previous);
        Assert.Null(removed.ProtectedCredential);
        Assert.Equal("not_configured", removed.ConnectionConfiguration.Authentication.GetProperty("secretState").GetString());
        Assert.Null(removed.ConnectionConfiguration.Authentication.GetProperty("lastRotatedAt").GetString());
    }

    [Fact]
    public void ChangingPrometheusEndpointRequiresReplacingTheCredential()
    {
        var request = BasicRequest();
        var previous = Previous(request, Prepare(request));
        request.Name = "Renamed";
        request.ProviderConfig = JsonSerializer.SerializeToElement(new { endpoint = "https://prom.example.test" });
        request.SecretUpdate = JsonSerializer.SerializeToElement(new { operation = "keep" });
        var kept = Prepare(request, previous);
        Assert.True(JsonElement.DeepEquals(previous.ConnectionConfiguration.Authentication, kept.ConnectionConfiguration.Authentication));

        request.ProviderConfig = JsonSerializer.SerializeToElement(new { endpoint = "https://prom.example.test/other" });
        Assert.Throws<BusinessException>(() => Prepare(request, previous));

        request.SecretUpdate = JsonSerializer.SerializeToElement(new { operation = "replace", password = "replacement-password" });
        var replaced = Prepare(request, previous);
        Assert.True(JsonElement.DeepEquals(request.ProviderConfig, replaced.ConnectionConfiguration.ProviderConfig));
        Assert.NotNull(replaced.ProtectedCredential);
    }

    [Fact]
    public void CiphertextIsBoundToVerifiedOwnershipAndStoredDestination()
    {
        var request = BasicRequest();
        var previous = Previous(request, Prepare(request));
        request.SecretUpdate = JsonSerializer.SerializeToElement(new { operation = "keep" });
        var projectId = request.ProjectId;
        request.ProjectId = Guid.NewGuid();
        Assert.Throws<BusinessException>(() => Prepare(request, previous));
        request.ProjectId = projectId;
        Assert.Throws<BusinessException>(() => ProviderConfiguration.Prepare(request, Guid.NewGuid(), _id, _protector, previous));
        Assert.Throws<BusinessException>(() => ProviderConfiguration.Prepare(request, _envId, Guid.NewGuid(), _protector, previous));

        previous.ConnectionConfiguration = previous.ConnectionConfiguration with
        {
            ProviderConfig = JsonSerializer.SerializeToElement(new { endpoint = "https://other.example.test" })
        };
        request.ProviderConfig = previous.ConnectionConfiguration.ProviderConfig;
        Assert.Throws<BusinessException>(() => Prepare(request, previous));
    }

    [Theory]
    [InlineData("""{"endpoint":"https://prom.example.test","token":"test-only"}""")]
    [InlineData("""{"endpoint":"https://prom.example.test","endpoint":"https://another.example.test"}""")]
    [InlineData("""{"endpoint":"https://user@prom.example.test"}""")]
    [InlineData("""{"endpoint":"https://prom.example.test/?token=test-only"}""")]
    [InlineData("""{"endpoint":"http://prom.example.test"}""")]
    public void RejectsUnexpectedFieldsAndUnsafeEndpointForms(string json)
    {
        var request = BasicRequest();
        request.ProviderConfig = JsonSerializer.Deserialize<JsonElement>(json);
        var error = Assert.Throws<BusinessException>(() => Prepare(request));
        Assert.DoesNotContain("test-only", error.Message);
    }

    private static ObservabilityProviderRequest BasicRequest() => new()
    {
        OrgId = Guid.NewGuid(), ProjectId = Guid.NewGuid(), ProviderType = ProviderConfiguration.Prometheus,
        ProviderConfig = JsonSerializer.SerializeToElement(new { endpoint = "https://prom.example.test/" }),
        Authentication = JsonSerializer.SerializeToElement(new { type = "basic", username = "reader" }),
        SecretUpdate = JsonSerializer.SerializeToElement(new { operation = "replace", password = "test-only-password" })
    };

    private PreparedProviderConfiguration Prepare(ObservabilityProviderRequest request, ObservabilityProvider? previous = null) =>
        ProviderConfiguration.Prepare(request, _envId, _id, _protector, previous);

    private static ObservabilityProvider Previous(ObservabilityProviderRequest request, PreparedProviderConfiguration stored) => new()
    {
        ProviderType = request.ProviderType, ProviderSchemaVersion = request.ProviderSchemaVersion,
        ConnectionConfiguration = stored.ConnectionConfiguration, ProtectedCredential = stored.ProtectedCredential
    };
}
