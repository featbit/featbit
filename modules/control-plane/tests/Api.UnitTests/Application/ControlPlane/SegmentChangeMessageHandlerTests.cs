using System.Collections.ObjectModel;
using Api.Application.ControlPlane;
using Application.Caches;
using Application.Segments;
using Application.Services;
using Domain.Messages;
using Domain.Segments;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Testing;
using Moq;

namespace Api.UnitTests.Application.ControlPlane;

public class SegmentChangeMessageHandlerTests
{
    private const string Region = "us-east-1";

    private readonly Mock<ICacheService> _cache = new();
    private readonly Mock<IFeatureFlagAppService> _ff = new();
    private readonly Mock<ISegmentMessageService> _segSvc = new();
    private readonly Mock<ISegmentService> _segmentService = new();
    private readonly FakeLogger<SegmentChangeMessageHandler> _logger = new();
    private readonly Mock<IMessageProducer> _producer = new();

    private static IConfiguration BuildConfiguration(string? consistencyMode)
    {
        var values = new Dictionary<string, string?>
        {
            ["Region"] = Region
        };

        if (consistencyMode != null)
        {
            values["ControlPlane:ConsistencyMode"] = consistencyMode;
        }

        return new ConfigurationBuilder().AddInMemoryCollection(values).Build();
    }

    private SegmentChangeMessageHandler CreateSut(string? consistencyMode = null)
        => new(
            _cache.Object,
            _ff.Object,
            _segSvc.Object,
            _segmentService.Object,
            _logger,
            BuildConfiguration(consistencyMode),
            _producer.Object);

    private static string BuildMessage(
        Guid env1, Guid env2, Guid segmentId, DateTime updatedAt,
        Guid? operatorId = null, string? operation = null, bool? isTargetingChange = null)
    {
        var notification = operatorId is null && operation is null && isTargetingChange is null
            ? "{}"
            : $$"""
                {
                  "operatorId": "{{operatorId}}",
                  "operation": "{{operation}}",
                  "isTargetingChange": {{(isTargetingChange!.Value ? "true" : "false")}}
                }
                """;

        return $$"""
                 {
                   "segmentNonSpecific": { "id": "{{segmentId}}", "updatedAt": "{{updatedAt:O}}" },
                   "envIds": ["{{env1}}","{{env2}}"],
                   "notification": {{notification}},
                   "region": "{{Region}}"
                 }
                 """;
    }

    [Fact]
    public async Task HandleAsync_WhenRequiredPropertiesMissing_Throws()
    {
        var sut = CreateSut();

        var payload = """{"anything":"else"}""";

        await Assert.ThrowsAsync<InvalidDataException>(() => sut.HandleAsync(payload));
    }

    [Fact]
    public async Task HandleAsync_WhenJsonInvalid_Rethrows()
    {
        var sut = CreateSut();

        await Assert.ThrowsAnyAsync<Exception>(() => sut.HandleAsync("{not valid json"));
    }

    [Fact]
    public async Task HandleAsync_BestEffort_UpsertsSegment_AndPublishesForEachEnv()
    {
        _segSvc
            .Setup(x => x.GetAffectedFlagsAsync(It.IsAny<Guid>(), It.IsAny<OnSegmentChange>()))
            .ReturnsAsync(new Collection<FlagReference>());

        _segSvc
            .Setup(x => x.PublishSegmentChangeMessage(It.IsAny<Guid>(), It.IsAny<ICollection<FlagReference>>(),
                It.IsAny<Segment>()))
            .Returns(Task.CompletedTask);

        var sut = CreateSut(consistencyMode: "BestEffort");

        var env1 = Guid.NewGuid();
        var env2 = Guid.NewGuid();

        var payload = BuildMessage(env1, env2, Guid.NewGuid(), DateTime.UtcNow);

        await sut.HandleAsync(payload);

        _cache.Verify(x => x.UpsertSegmentAsync(It.IsAny<ICollection<Guid>>(), It.IsAny<Segment>()), Times.Once);

        _ff.Verify(
            x => x.OnSegmentUpdatedAsync(It.IsAny<Segment>(), It.IsAny<Guid>(), It.IsAny<ICollection<FlagReference>>()),
            Times.Never);

        _segSvc.Verify(
            x => x.PublishSegmentChangeMessage(env1, It.IsAny<ICollection<FlagReference>>(), It.IsAny<Segment>()),
            Times.Once);
        _segSvc.Verify(
            x => x.PublishSegmentChangeMessage(env2, It.IsAny<ICollection<FlagReference>>(), It.IsAny<Segment>()),
            Times.Once);

        // BestEffort must NOT use the stage/commit path.
        _cache.Verify(x => x.StageSegmentAsync(It.IsAny<Segment>(), It.IsAny<long>()), Times.Never);
        _segmentService.Verify(
            x => x.SetPendingAsync(It.IsAny<Guid>(), It.IsAny<Segment>(), It.IsAny<long>()), Times.Never);
    }

    [Fact]
    public async Task HandleAsync_WhenModeUnset_DefaultsToBestEffort()
    {
        _segSvc
            .Setup(x => x.GetAffectedFlagsAsync(It.IsAny<Guid>(), It.IsAny<OnSegmentChange>()))
            .ReturnsAsync(new Collection<FlagReference>());

        var sut = CreateSut(consistencyMode: null);

        var env1 = Guid.NewGuid();
        var env2 = Guid.NewGuid();

        var payload = BuildMessage(env1, env2, Guid.NewGuid(), DateTime.UtcNow);

        await sut.HandleAsync(payload);

        _cache.Verify(x => x.UpsertSegmentAsync(It.IsAny<ICollection<Guid>>(), It.IsAny<Segment>()), Times.Once);
        _cache.Verify(x => x.StageSegmentAsync(It.IsAny<Segment>(), It.IsAny<long>()), Times.Never);
    }

    [Fact]
    public async Task HandleAsync_GatedCommit_StagesAndSetsPending_DoesNotPublishSegmentChange()
    {
        var sut = CreateSut(consistencyMode: "GatedCommit");

        var env1 = Guid.NewGuid();
        var env2 = Guid.NewGuid();
        var segmentId = Guid.NewGuid();
        var updatedAt = new DateTime(2026, 1, 2, 3, 4, 5, DateTimeKind.Utc);
        var expectedTs = new DateTimeOffset(updatedAt).ToUnixTimeMilliseconds();

        // Use non-default attribution values (a real operator, a non-Update operation, and
        // isTargetingChange = false) so the assertions below can't be satisfied by accident with
        // the legacy hardcoded reconstruction values (Guid.Empty / Update / true).
        var operatorId = Guid.NewGuid();
        const string operation = "Archive";
        const bool isTargetingChange = false;

        var payload = BuildMessage(
            env1, env2, segmentId, updatedAt,
            operatorId: operatorId, operation: operation, isTargetingChange: isTargetingChange);

        await sut.HandleAsync(payload);

        _cache.Verify(
            x => x.StageSegmentAsync(It.Is<Segment>(s => s.Id == segmentId), expectedTs),
            Times.Once);
        _segmentService.Verify(
            x => x.SetPendingAsync(
                segmentId,
                It.Is<Segment>(s => s.Id == segmentId),
                expectedTs,
                operatorId,
                operation,
                isTargetingChange),
            Times.Once);

        // GatedCommit must hold the affected-flags / segment-change propagation for the coordinator.
        _cache.Verify(x => x.UpsertSegmentAsync(It.IsAny<ICollection<Guid>>(), It.IsAny<Segment>()), Times.Never);
        _ff.Verify(
            x => x.OnSegmentUpdatedAsync(It.IsAny<Segment>(), It.IsAny<Guid>(), It.IsAny<ICollection<FlagReference>>()),
            Times.Never);
        _segSvc.Verify(
            x => x.PublishSegmentChangeMessage(
                It.IsAny<Guid>(), It.IsAny<ICollection<FlagReference>>(), It.IsAny<Segment>()),
            Times.Never);
        _segSvc.Verify(
            x => x.GetAffectedFlagsAsync(It.IsAny<Guid>(), It.IsAny<OnSegmentChange>()),
            Times.Never);
    }
}
