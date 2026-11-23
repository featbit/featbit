using System.Text.Json;
using Api.Controllers;
using Application.ReleaseMetricSourceConnections;
using Application.Services;
using Domain.Environments;
using Domain.ReleaseMetricSourceConnections;
using Microsoft.AspNetCore.Mvc;

namespace Api.UnitTests.Controllers;

public class ReleaseMetricSourceConnectionResponseTests
{
    private const string SubmittedSecret = "test-only-submitted-credential";
    private const string StoredCredential = "test-only-protected-credential";

    [Theory]
    [InlineData("prometheus-compatible", """{"endpoint":"https://metrics.example.com"}""", """{"type":"bearer_token"}""", "token")]
    [InlineData("azure-monitor", """{"workspaceId":"workspace"}""", """{"mode":"ClientSecret","tenantId":"tenant","clientId":"client"}""", "clientSecret")]
    public async Task CreateResponse_ReportsConfiguredWithoutEchoingCredentials(
        string providerType, string providerConfig, string authentication, string secretField)
    {
        var request = new CreateReleaseMetricSourceConnection
        {
            EnvId = Guid.NewGuid(),
            Scope = new ResourceDescriptor(),
            Name = "Metrics",
            ProviderType = providerType,
            ProviderConfig = JsonSerializer.Deserialize<JsonElement>(providerConfig),
            Authentication = JsonSerializer.Deserialize<JsonElement>(authentication),
            SecretUpdate = JsonSerializer.SerializeToElement(new Dictionary<string, string>
            {
                ["operation"] = "replace",
                [secretField] = SubmittedSecret
            })
        };
        var protector = new Mock<IReleaseMetricSourceCredentialProtector>(MockBehavior.Strict);
        protector.Setup(x => x.Protect(request.Scope, It.IsAny<ReleaseMetricSourceConnection>(),
                It.Is<JsonElement>(credential => credential.GetProperty(secretField).GetString() == SubmittedSecret)))
            .Returns(StoredCredential);
        var handler = new CreateReleaseMetricSourceConnectionHandler(Mock.Of<IReleaseMetricSourceConnectionService>(), protector.Object);

        var result = await handler.Handle(request, CancellationToken.None);

        var data = SerializeResponse(result);
        AssertPublicCredentialState(data, "configured");
        Assert.True(JsonElement.DeepEquals(request.ProviderConfig, data.GetProperty("providerConfig")));
        Assert.True(JsonElement.DeepEquals(request.Authentication, data.GetProperty("authentication")));
    }

    [Fact]
    public async Task ListResponse_DistinguishesStoredCredentialFromLegacyBasicConnection()
    {
        var envId = Guid.NewGuid();
        var settings = new ReleaseMetricSourceConnectionSettings(
            JsonSerializer.SerializeToElement(new { endpoint = "https://metrics.example.com" }),
            JsonSerializer.SerializeToElement(new { type = "basic", username = "reader" }));
        var configured = new ReleaseMetricSourceConnection(envId, "Configured", "prometheus-compatible", settings)
        {
            ProtectedCredential = StoredCredential
        };
        var legacy = new ReleaseMetricSourceConnection(envId, "Legacy", "prometheus-compatible", settings);
        var service = new Mock<IReleaseMetricSourceConnectionService>();
        service.Setup(x => x.GetListAsync(envId, CancellationToken.None)).ReturnsAsync([configured, legacy]);
        var handler = new GetReleaseMetricSourceConnectionListHandler(service.Object);

        var result = await handler.Handle(new GetReleaseMetricSourceConnectionList { EnvId = envId }, CancellationToken.None);

        var data = SerializeResponse(result);
        var connections = data.EnumerateArray().ToDictionary(item => item.GetProperty("id").GetGuid());
        AssertPublicCredentialState(connections[configured.Id], "configured");
        AssertPublicCredentialState(connections[legacy.Id], "not_configured");
    }

    private static JsonElement SerializeResponse<T>(T result)
    {
        var response = JsonSerializer.SerializeToElement(ApiResponse<T>.Ok(result), new JsonOptions().JsonSerializerOptions);
        var json = response.GetRawText();
        Assert.DoesNotContain(SubmittedSecret, json);
        Assert.DoesNotContain(StoredCredential, json);
        return response.GetProperty("data");
    }

    private static void AssertPublicCredentialState(JsonElement item, string expected)
    {
        Assert.Equal(expected, item.GetProperty("secretState").GetString());
        Assert.False(item.TryGetProperty("secretUpdate", out _));
        Assert.False(item.TryGetProperty("protectedCredential", out _));
    }
}
