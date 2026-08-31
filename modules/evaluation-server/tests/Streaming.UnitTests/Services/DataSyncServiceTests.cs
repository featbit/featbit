using System.Text.Json;
using System.Text;
using Domain.EndUsers;
using Domain.Evaluation;
using Domain.Shared;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Logging.Testing;
using Moq;
using Streaming.Connections;
using Streaming.Protocol;
using Streaming.Services;

namespace Streaming.UnitTests.Services;

public class DataSyncServiceTests
{
    private readonly Mock<IStore> _store = new();
    private readonly Mock<IEvaluator> _evaluator = new();
    private readonly Mock<IRelayProxyService> _rpService = new();
    private readonly DataSyncService _service;

    private static readonly Guid EnvId = Guid.Parse("226b9bf8-4af3-4ffa-9b01-162270e4cd40");

    public DataSyncServiceTests()
    {
        _service = new DataSyncService(
            _store.Object,
            _evaluator.Object,
            _rpService.Object,
            NullLogger<DataSyncService>.Instance
        );
    }

    [Fact]
    public async Task GetFlagChangePayloadAsync_ServerConnection_ReturnsServerSdkPayloadWrappingFlag()
    {
        var connection = NewConnection(SecretTypes.Server);
        var flag = ParseJson("""{"id":"flag-1","key":"k","envId":"00000000-0000-0000-0000-000000000001"}""");

        var payload = await _service.GetFlagChangePayloadAsync(connection, flag);

        var sdk = Assert.IsType<ServerSdkPayload>(payload);
        Assert.Equal(DataSyncEventTypes.Patch, sdk.EventType);
        var single = Assert.Single(sdk.FeatureFlags);
        Assert.Equal("flag-1", single["id"]!.ToString());
        Assert.Empty(sdk.Segments);
    }

    [Fact]
    public async Task GetFlagChangePayloadAsync_ClientConnectionWithoutUser_ThrowsArgumentException()
    {
        var connection = NewConnection(SecretTypes.Client);
        var flag = ParseJson("""{"id":"flag-1"}""");

        await Assert.ThrowsAsync<ArgumentException>(
            () => _service.GetFlagChangePayloadAsync(connection, flag));
    }

    [Fact]
    public async Task GetFlagChangePayloadAsync_UnsupportedConnectionType_ThrowsArgumentOutOfRange()
    {
        var connection = NewConnection(ConnectionType.RelayProxy);
        var flag = ParseJson("""{"id":"flag-1"}""");

        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(
            () => _service.GetFlagChangePayloadAsync(connection, flag));
    }

    [Fact]
    public async Task GetSegmentChangePayloadAsync_ServerConnection_ReturnsServerSdkPayloadWrappingSegment()
    {
        var connection = NewConnection(SecretTypes.Server);
        var segment = ParseJson("""{"id":"seg-1","key":"all"}""");

        var payload = await _service.GetSegmentChangePayloadAsync(connection, segment, ["unused"]);

        var sdk = Assert.IsType<ServerSdkPayload>(payload);
        Assert.Equal(DataSyncEventTypes.Patch, sdk.EventType);
        Assert.Empty(sdk.FeatureFlags);
        var single = Assert.Single(sdk.Segments);
        Assert.Equal("seg-1", single["id"]!.ToString());
    }

    [Fact]
    public async Task GetSegmentChangePayloadAsync_ClientConnectionWithoutUser_ThrowsArgumentException()
    {
        var connection = NewConnection(SecretTypes.Client);
        var segment = ParseJson("""{"id":"seg-1"}""");

        await Assert.ThrowsAsync<ArgumentException>(
            () => _service.GetSegmentChangePayloadAsync(connection, segment, ["a"]));
    }

    [Fact]
    public async Task GetSegmentChangePayloadAsync_UnsupportedConnectionType_ThrowsArgumentOutOfRange()
    {
        var connection = NewConnection(ConnectionType.RelayProxy);
        var segment = ParseJson("""{"id":"seg-1"}""");

        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(
            () => _service.GetSegmentChangePayloadAsync(connection, segment, []));
    }

    [Fact]
    public async Task GetServerSdkPayloadAsync_FullSyncTimestamp_RequestsFullDataAndMarksEventAsFull()
    {
        var flagBytes = "{\"id\":\"f1\"}"u8.ToArray();
        var segmentBytes = "{\"id\":\"s1\"}"u8.ToArray();
        _store.Setup(s => s.GetFlagsAsync(EnvId, 0L)).ReturnsAsync(new[] { flagBytes });
        _store.Setup(s => s.GetSegmentsAsync(EnvId, 0L)).ReturnsAsync(new[] { segmentBytes });

        var payload = await _service.GetServerSdkPayloadAsync(EnvId, timestamp: 0);

        Assert.Equal(DataSyncEventTypes.Full, payload.EventType);
        Assert.Single(payload.FeatureFlags);
        Assert.Single(payload.Segments);
    }

    [Fact]
    public async Task GetServerSdkPayloadAsync_NonZeroTimestamp_MarksEventAsPatch()
    {
        _store.Setup(s => s.GetFlagsAsync(EnvId, It.IsAny<long>())).ReturnsAsync(Array.Empty<byte[]>());
        _store.Setup(s => s.GetSegmentsAsync(EnvId, It.IsAny<long>())).ReturnsAsync(Array.Empty<byte[]>());

        var payload = await _service.GetServerSdkPayloadAsync(EnvId, timestamp: 100);

        Assert.Equal(DataSyncEventTypes.Patch, payload.EventType);
        Assert.Empty(payload.FeatureFlags);
        Assert.Empty(payload.Segments);
    }

    [Fact]
    public async Task GetClientSdkPayloadAsync_OneFlagCannotBeEvaluated_SkipsItAndReturnsOtherFlags()
    {
        _store.Setup(s => s.GetFlagsAsync(EnvId, 0L)).ReturnsAsync(
            new[] { FlagBytes("broken", "broken-key"), FlagBytes("healthy", "healthy-key") }
        );
        _evaluator.SetupSequence(x => x.EvaluateAsync(It.IsAny<EvaluationScope>()))
            .ThrowsAsync(EntityJsonReader.FeatureFlag.Malformed("invalid segment condition"))
            .ReturnsAsync(NullUserVariation.Instance);

        var payload = await _service.GetClientSdkPayloadAsync(EnvId, NewUser(), timestamp: 0);

        Assert.Equal(DataSyncEventTypes.Full, payload.EventType);
        var flag = Assert.Single(payload.FeatureFlags);
        Assert.Equal("healthy-key", flag.Id);
    }

    [Fact]
    public async Task GetClientSdkPayloadAsync_MalformedFlagJson_SkipsItAndReturnsOtherFlags()
    {
        var logger = new FakeLogger<DataSyncService>();
        var service = new DataSyncService(_store.Object, _evaluator.Object, _rpService.Object, logger);
        _store.Setup(s => s.GetFlagsAsync(EnvId, 0L)).ReturnsAsync(
            new[] { "{"u8.ToArray(), FlagBytes("healthy", "healthy-key") }
        );
        _evaluator.Setup(x => x.EvaluateAsync(It.IsAny<EvaluationScope>()))
            .ReturnsAsync(NullUserVariation.Instance);

        var payload = await service.GetClientSdkPayloadAsync(EnvId, NewUser(), timestamp: 0);

        var flag = Assert.Single(payload.FeatureFlags);
        Assert.Equal("healthy-key", flag.Id);
        var record = Assert.Single(logger.Collector.GetSnapshot());
        var exception = Assert.IsType<MalformedDataException>(record.Exception);
        Assert.Equal(EvaluationEntityType.FeatureFlag, exception.EntityType);
    }

    [Fact]
    public async Task GetClientSdkPayloadAsync_SegmentContainsNonStringListValue_SkipsDependentFlag()
    {
        const string segmentId = "0779d76b-afc6-4886-ab65-af8c004273ad";
        var store = new Mock<IStore>();
        store.Setup(s => s.GetFlagsAsync(EnvId, 0L)).ReturnsAsync(
            new[]
            {
                EvaluableFlagBytes("broken-key", segmentId, isEnabled: true),
                EvaluableFlagBytes("healthy-key", segmentId: null, isEnabled: false)
            }
        );
        store.Setup(s => s.GetSegmentAsync(segmentId)).ReturnsAsync(BrokenSegmentBytes(segmentId));
        var evaluator = new Evaluator(new RuleMatcher(store.Object));
        var logger = new FakeLogger<DataSyncService>();
        var service = new DataSyncService(
            store.Object,
            evaluator,
            _rpService.Object,
            logger
        );

        var payload = await service.GetClientSdkPayloadAsync(EnvId, NewUser(), timestamp: 0);

        var flag = Assert.Single(payload.FeatureFlags);
        Assert.Equal("healthy-key", flag.Id);
        var record = Assert.Single(logger.Collector.GetSnapshot());
        var exception = Assert.IsType<MalformedDataException>(record.Exception);
        Assert.Equal(EvaluationEntityType.Segment, exception.EntityType);
        Assert.Equal(segmentId, exception.EntityId);
    }

    [Fact]
    public async Task GetClientSdkPayloadAsync_InvalidSegmentId_SkipsDependentFlagWithoutCallingStore()
    {
        const string invalidSegmentId = "not-a-guid";
        var store = new Mock<IStore>();
        store.Setup(s => s.GetFlagsAsync(EnvId, 0L)).ReturnsAsync(
            new[]
            {
                EvaluableFlagBytes("broken-key", invalidSegmentId, isEnabled: true),
                EvaluableFlagBytes("healthy-key", segmentId: null, isEnabled: false)
            }
        );
        var logger = new FakeLogger<DataSyncService>();
        var service = new DataSyncService(
            store.Object,
            new Evaluator(new RuleMatcher(store.Object)),
            _rpService.Object,
            logger
        );

        var payload = await service.GetClientSdkPayloadAsync(EnvId, NewUser(), timestamp: 0);

        var flag = Assert.Single(payload.FeatureFlags);
        Assert.Equal("healthy-key", flag.Id);
        store.Verify(s => s.GetSegmentAsync(It.IsAny<string>()), Times.Never);
        var record = Assert.Single(logger.Collector.GetSnapshot());
        var exception = Assert.IsType<MalformedDataException>(record.Exception);
        Assert.Equal(EvaluationEntityType.FeatureFlag, exception.EntityType);
        Assert.Equal("value", exception.PropertyPath);
    }

    [Fact]
    public async Task GetClientSdkPayloadAsync_NullVariation_SkipsItAndReturnsOtherFlags()
    {
        _store.Setup(s => s.GetFlagsAsync(EnvId, 0L)).ReturnsAsync(
            new[] { FlagWithNullVariationBytes(), FlagBytes("healthy", "healthy-key") }
        );
        _evaluator.Setup(x => x.EvaluateAsync(It.IsAny<EvaluationScope>()))
            .ReturnsAsync(NullUserVariation.Instance);

        var payload = await _service.GetClientSdkPayloadAsync(EnvId, NewUser(), timestamp: 0);

        var flag = Assert.Single(payload.FeatureFlags);
        Assert.Equal("healthy-key", flag.Id);
    }

    [Fact]
    public async Task GetClientSegmentChangePayloadAsync_OneFlagCannotBeEvaluated_SkipsItAndReturnsOtherFlags()
    {
        _store.Setup(s => s.GetFlagsAsync(new[] { "broken", "healthy" })).ReturnsAsync(
            new[] { FlagBytes("broken", "broken-key"), FlagBytes("healthy", "healthy-key") }
        );
        _evaluator.SetupSequence(x => x.EvaluateAsync(It.IsAny<EvaluationScope>()))
            .ThrowsAsync(EntityJsonReader.FeatureFlag.Malformed("invalid segment condition"))
            .ReturnsAsync(NullUserVariation.Instance);
        var connection = NewConnection(SecretTypes.Client);
        connection.AttachUser(NewUser());

        var payload = await _service.GetSegmentChangePayloadAsync(
            connection,
            ParseJson($$"""{"envId":"{{EnvId}}"}"""),
            ["broken", "healthy"]
        );

        var clientPayload = Assert.IsType<ClientSdkPayload>(payload);
        Assert.Equal(DataSyncEventTypes.Patch, clientPayload.EventType);
        var flag = Assert.Single(clientPayload.FeatureFlags);
        Assert.Equal("healthy-key", flag.Id);
    }

    [Fact]
    public async Task GetFlagChangePayloadAsync_FlagCannotBeEvaluated_ReturnsEmptyPatch()
    {
        _evaluator.Setup(x => x.EvaluateAsync(It.IsAny<EvaluationScope>()))
            .ThrowsAsync(EntityJsonReader.FeatureFlag.Malformed("invalid flag condition"));
        var connection = NewConnection(SecretTypes.Client);
        connection.AttachUser(NewUser());
        var flag = ParseJson(Encoding.UTF8.GetString(FlagBytes("broken", "broken-key")));

        var payload = await _service.GetFlagChangePayloadAsync(connection, flag);

        var clientPayload = Assert.IsType<ClientSdkPayload>(payload);
        Assert.Equal(DataSyncEventTypes.Patch, clientPayload.EventType);
        Assert.Empty(clientPayload.FeatureFlags);
    }

    [Fact]
    public async Task GetClientSdkPayloadAsync_InfrastructureFailure_Propagates()
    {
        _store.Setup(s => s.GetFlagsAsync(EnvId, 0L)).ReturnsAsync(
            new[] { FlagBytes("flag", "flag-key") }
        );
        _evaluator.Setup(x => x.EvaluateAsync(It.IsAny<EvaluationScope>()))
            .ThrowsAsync(new TimeoutException("store unavailable"));

        await Assert.ThrowsAsync<TimeoutException>(
            () => _service.GetClientSdkPayloadAsync(EnvId, NewUser(), timestamp: 0)
        );
    }

    [Fact]
    public async Task GetClientSdkPayloadAsync_SegmentStoreFailure_PropagatesWithoutBeingWrapped()
    {
        const string segmentId = "0779d76b-afc6-4886-ab65-af8c004273ad";
        var store = new Mock<IStore>();
        store.Setup(s => s.GetFlagsAsync(EnvId, 0L)).ReturnsAsync(
            new[] { EvaluableFlagBytes("flag-key", segmentId, isEnabled: true) }
        );
        store.Setup(s => s.GetSegmentAsync(segmentId))
            .ThrowsAsync(new InvalidOperationException("store unavailable"));
        var service = new DataSyncService(
            store.Object,
            new Evaluator(new RuleMatcher(store.Object)),
            _rpService.Object,
            NullLogger<DataSyncService>.Instance
        );

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.GetClientSdkPayloadAsync(EnvId, NewUser(), timestamp: 0)
        );

        Assert.Equal("store unavailable", exception.Message);
    }

    private static Connection NewConnection(string type) =>
        new(Mock.Of<System.Net.WebSockets.WebSocket>(), new Secret(type, "p", EnvId, "dev"));

    private static JsonElement ParseJson(string json) =>
        JsonDocument.Parse(json).RootElement.Clone();

    private static EndUser NewUser() => new() { KeyId = "user-key", Name = "user-name" };

    private static byte[] FlagBytes(string id, string key) =>
        Encoding.UTF8.GetBytes($$"""
          {
            "id":"{{id}}",
            "key":"{{key}}",
            "envId":"{{EnvId}}",
            "variations":[],
            "variationType":"string",
            "updatedAt":"2026-08-29T00:00:00Z"
          }
          """);

    private static byte[] FlagWithNullVariationBytes() =>
        Encoding.UTF8.GetBytes($$"""
          {
            "id":"4abf8ca8-7dc8-41d9-83ab-73a6d194e926",
            "key":"broken-key",
            "envId":"{{EnvId}}",
            "variations":[null],
            "variationType":"boolean",
            "updatedAt":"2026-08-29T00:00:00Z"
          }
          """);

    private static byte[] EvaluableFlagBytes(string key, string? segmentId, bool isEnabled)
    {
        const string variationId = "d3e3b90b-9a63-4493-8e2f-25b145e8199d";
        var rules = segmentId == null
            ? "[]"
            : $$"""
              [{
                "name":"segment rule",
                "dispatchKey":null,
                "includedInExpt":false,
                "conditions":[{
                  "property":"User is in segment",
                  "op":null,
                  "value":"[\"{{segmentId}}\"]"
                }],
                "variations":[{
                  "id":"{{variationId}}",
                  "rollout":[0,1],
                  "exptRollout":1
                }]
              }]
              """;

        return Encoding.UTF8.GetBytes($$"""
          {
            "id":"{{Guid.NewGuid()}}",
            "key":"{{key}}",
            "envId":"{{EnvId}}",
            "variations":[{"id":"{{variationId}}","value":"true"}],
            "variationType":"boolean",
            "updatedAt":"2026-08-29T00:00:00Z",
            "isArchived":false,
            "isEnabled":{{isEnabled.ToString().ToLowerInvariant()}},
            "disabledVariationId":"{{variationId}}",
            "exptIncludeAllTargets":false,
            "targetUsers":[],
            "rules":{{rules}},
            "fallthrough":{
              "dispatchKey":null,
              "includedInExpt":false,
              "variations":[{"id":"{{variationId}}","rollout":[0,1],"exptRollout":1}]
            }
          }
          """);
    }

    private static byte[] BrokenSegmentBytes(string segmentId) =>
        Encoding.UTF8.GetBytes($$"""
          {
            "id":"{{segmentId}}",
            "included":[],
            "excluded":[],
            "rules":[{
              "conditions":[{
                "property":"companyId",
                "op":"IsOneOf",
                "value":"[1,\"company-2\"]"
              }]
            }]
          }
          """);
}
