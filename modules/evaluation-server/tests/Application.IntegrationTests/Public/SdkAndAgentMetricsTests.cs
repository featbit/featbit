using System.Net;
using System.Net.Http.Json;
using Domain.Observability;
using Domain.Shared;
using FeatBit.Observability.TestKit;

namespace Application.IntegrationTests.Public;

/// <summary>
/// Covers the HTTP polling sync endpoints and the agent registration counter. Both were previously
/// uninstrumented: the streaming path recorded the sync instruments from inside
/// <c>DataSyncService</c>, which polling SDKs and relay proxies never reach.
/// </summary>
[Trait("Category", "Host")]
[Collection(nameof(TestApp))]
public class SdkAndAgentMetricsTests(TestApp app)
{
    /// <summary>
    /// A request with no timestamp is a full bootstrap, and it must be distinguishable from the
    /// streaming <c>full</c> operation so a shift between transports is visible rather than hidden.
    /// </summary>
    [Fact]
    public async Task GetServerSideSdkPayload_WithoutTimestamp_RecordsHttpFullSync()
    {
        using var collector = new MetricCollector(SyncMetrics.Current.Meter);

        var client = app.CreateClient();
        client.DefaultRequestHeaders.Add("Authorization", TestData.ServerSecretString);

        var response = await client.GetAsync("/api/public/sdk/server/latest-all");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = Assert.Single(
            collector.For("sync.payloads"),
            m => (string?)m.Tag(ObservabilityTags.Operation) == SyncMetrics.HttpFullOperation &&
                 (string?)m.Tag(ObservabilityTags.ConnectionType) == "server");

        Assert.Equal(Outcomes.Success, payload.Tag(ObservabilityTags.Outcome));
        Assert.Contains(
            collector.For("sync.duration"),
            m => (string?)m.Tag(ObservabilityTags.Operation) == SyncMetrics.HttpFullOperation);
    }

    /// <summary>
    /// A non-zero timestamp is an incremental poll. Merging it with the bootstrap would hide the
    /// most expensive request an SDK ever makes inside the cheapest one it makes constantly.
    /// </summary>
    [Fact]
    public async Task GetServerSideSdkPayload_WithTimestamp_RecordsHttpPatchSync()
    {
        using var collector = new MetricCollector(SyncMetrics.Current.Meter);

        var client = app.CreateClient();
        client.DefaultRequestHeaders.Add("Authorization", TestData.ServerSecretString);

        var response = await client.GetAsync("/api/public/sdk/server/latest-all?timestamp=1700000000000");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains(
            collector.For("sync.payloads"),
            m => (string?)m.Tag(ObservabilityTags.Operation) == SyncMetrics.HttpPatchOperation);
    }

    /// <summary>
    /// The client sync carries <c>connection_type=client</c>, so one panel separates the two SDK
    /// families without a second instrument.
    /// </summary>
    [Fact]
    public async Task GetClientSideSdkPayload_ForAValidRequest_RecordsTheClientConnectionType()
    {
        using var collector = new MetricCollector(SyncMetrics.Current.Meter);

        var client = app.CreateClient();
        client.DefaultRequestHeaders.Add("Authorization", TestData.ServerSecretString);

        var request = new { user = new { key = "test-user", name = "Test User" } };

        await client.PostAsJsonAsync("/api/public/sdk/client/latest-all?timestamp=0", request);

        Assert.Contains(
            collector.For("sync.payloads"),
            m => (string?)m.Tag(ObservabilityTags.Operation) == SyncMetrics.HttpFullOperation &&
                 (string?)m.Tag(ObservabilityTags.ConnectionType) == "client");
    }

    /// <summary>
    /// A malformed end user is a client defect, not a server fault. Recording it as a failure
    /// would let one broken caller inflate the sync failure rate and make it useless as an alert.
    /// </summary>
    [Fact]
    public async Task GetClientSideSdkPayload_WithInvalidEndUser_RecordsRejectedNotFailure()
    {
        using var collector = new MetricCollector(SyncMetrics.Current.Meter);

        var client = app.CreateClient();
        client.DefaultRequestHeaders.Add("Authorization", TestData.ServerSecretString);

        var request = new { user = new { key = "", name = "" } };

        var response = await client.PostAsJsonAsync("/api/public/sdk/client/latest-all", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var clientSyncs = collector.For("sync.payloads")
            .Where(m => (string?)m.Tag(ObservabilityTags.ConnectionType) == "client")
            .ToArray();

        Assert.NotEmpty(clientSyncs);
        Assert.All(clientSyncs, m => Assert.Equal(Outcomes.Rejected, m.Tag(ObservabilityTags.Outcome)));
        Assert.DoesNotContain(
            clientSyncs, m => (string?)m.Tag(ObservabilityTags.Outcome) == Outcomes.Failure);
    }

    /// <summary>
    /// An agent that cannot register is invisible from the agent's own side too — it simply never
    /// appears. The counter is the only place an operator can see the attempt at all.
    /// </summary>
    [Fact]
    public async Task AgentRegister_WithoutAuth_RecordsUnauthorizedRegistration()
    {
        using var collector = new MetricCollector(AgentMetrics.Current.Meter);

        var client = app.CreateClient();

        var response = await client.PostAsJsonAsync("/api/public/agent/register", "agent-id");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);

        var registration = Assert.Single(collector.For("agent.registrations"));

        Assert.Equal(Outcomes.Rejected, registration.Tag(ObservabilityTags.Outcome));
        Assert.Equal(AgentReasons.Unauthorized, registration.Tag(ObservabilityTags.Reason));
    }
}
