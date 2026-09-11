using Application.Bases;
using Application.Bases.Exceptions;
using Application.Experiments;
using Application.Experiments.ExperimentLayers;
using Application.ExperimentStats;
using Application.Services;
using Domain.Experiments;
using Moq;

namespace Infrastructure.IntegrationTests.Experiments;

[Collection(nameof(ExperimentProviderParityCollection))]
public sealed class PostgresLayerReservationTests(ExperimentProviderParityFixture fixture)
    : ExperimentLayerReservationTests(fixture, "Postgres");

[Collection(nameof(ExperimentProviderParityCollection))]
public sealed class MongoDbLayerReservationTests(ExperimentProviderParityFixture fixture)
    : ExperimentLayerReservationTests(fixture, "MongoDb");

public abstract class ExperimentLayerReservationTests(ExperimentProviderParityFixture fixture, string provider)
    : IntegrationTestBase
{
    private static readonly Guid EnvId = ExperimentProviderParityFixture.EnvId;
    private readonly ExperimentLayer _layer = new()
    {
        Id = Guid.NewGuid(), Key = $"reservation-{Guid.NewGuid():N}", AssignmentUnitSelector = "user.keyId"
    };

    // A fresh service/context also proves that failed writes did not reach the database.
    private IExperimentService Service() => fixture.CreateExperimentServices(provider).ExperimentService;

    [DockerFact]
    public async Task WindowEdits_CheckFutureReservations()
    {
        var first = await CreateRun(Day(1), Day(10));
        var second = await CreateRun(Day(10), Day(20));
        await AssertConflict(() => Service().UpdateRunObservationWindowAsync(EnvId, second.ExperimentId, second.Id,
            new ExperimentRunObservationWindowUpdate { ObservationStart = Day(5), ObservationEnd = Day(20) }));
        await AssertConflict(() => Service().UpdateRunObservationWindowAsync(EnvId, first.ExperimentId, first.Id,
            new ExperimentRunObservationWindowUpdate { ObservationStart = Day(1), ObservationEnd = Day(11) }));
        await AssertConflict(() => Service().UpdateRunObservationWindowAsync(EnvId, first.ExperimentId, first.Id,
            new ExperimentRunObservationWindowUpdate { ObservationStart = Day(1), ObservationEnd = null }));
        await AssertConflict(() => Service().UpdateRunAsync(EnvId, second.ExperimentId, second.Id,
            new ExperimentRunUpdate { ObservationStart = Day(5) }));

        var persisted = await Service().GetAsync(EnvId, second.ExperimentId);
        Assert.Equal(Day(10), Assert.Single(persisted.ExperimentRuns).ObservationStart);
        Assert.Equal(0, (await Allocation()).AllocationSummary.ReservedPercent);
    }

    [DockerFact]
    public async Task BucketEdits_CheckOverlapAndAllowAdjacentBuckets()
    {
        await CreateRun(Day(1), null);
        var second = await CreateRun(Day(5), null, 30, 60);
        await AssertConflict(() => Service().UpdateRunAudienceAsync(EnvId, second.ExperimentId, second.Id,
            new ExperimentRunAudienceUpdate { LayerKey = _layer.Key, SliceStart = 20, SliceEnd = 50 }));
        var persisted = await Service().GetAsync(EnvId, second.ExperimentId);
        Assert.Equal(30, Assert.Single(persisted.ExperimentRuns).SliceStart);
    }

    [DockerFact]
    public async Task CreateRun_ValidatesInheritedLayerAgainstFutureReservations()
    {
        var first = await CreateRun(DateTime.UtcNow.AddDays(-10), DateTime.UtcNow.AddDays(-9));
        await CreateRun(Day(1), Day(10));
        await AssertConflict(() => Service().CreateRunAsync(EnvId, first.ExperimentId));
        Assert.Single((await Service().GetAsync(EnvId, first.ExperimentId)).ExperimentRuns);
    }

    [DockerFact]
    public async Task SameExperimentRuns_UnionCurrentBucketsAndPreserveHistory()
    {
        var now = DateTime.UtcNow;
        var first = await CreateRun(now.AddDays(-1), null);
        var detail = await Service().CreateRunAsync(EnvId, first.ExperimentId);
        var second = detail.ExperimentRuns.Single(x => x.Id != first.Id);
        await Service().UpdateRunAsync(EnvId, first.ExperimentId, second.Id,
            new ExperimentRunUpdate { SliceStart = 20, SliceEnd = 50, Decision = "ROLLBACK" });

        var allocation = await Allocation();
        Assert.Equal(50, allocation.AllocationSummary.ReservedPercent);
        Assert.Empty(allocation.AllocationSummary.Overlaps);
        Assert.Equal(2, allocation.ExperimentRuns.Count);
    }

    [DockerFact]
    public async Task ObservationWindow_RequiresStartAndIncreasingEnd()
    {
        var run = await CreateRun(Day(1), Day(10));
        foreach (var update in new[]
                 {
                     new ExperimentRunObservationWindowUpdate(),
                     new ExperimentRunObservationWindowUpdate { ObservationStart = Day(10), ObservationEnd = Day(10) },
                     new ExperimentRunObservationWindowUpdate { ObservationStart = Day(11), ObservationEnd = Day(10) }
                 })
        {
            await Assert.ThrowsAsync<BusinessException>(() =>
                Service().UpdateRunObservationWindowAsync(EnvId, run.ExperimentId, run.Id, update));
        }
    }

    private async Task<ExperimentRunVm> CreateRun(
        DateTime start, DateTime? end, double bucketStart = 0, double bucketEnd = 30)
    {
        var experiment = new Experiment
        {
            Id = Guid.NewGuid(), Name = "Layer reservation test", Stage = "measuring", EnvId = EnvId
        };
        await Service().CreateAsync(experiment);
        var created = await Service().CreateRunAsync(EnvId, experiment.Id);
        var run = Assert.Single(created.ExperimentRuns);
        Assert.Equal(run.CreatedAt, run.ObservationStart);
        var updated = await Service().UpdateRunAsync(EnvId, experiment.Id, run.Id, new ExperimentRunUpdate
        {
            LayerKey = _layer.Key, SliceStart = bucketStart, SliceEnd = bucketEnd,
            ObservationStart = start, ObservationEnd = end, Decision = "CONTINUE"
        });
        return Assert.Single(updated.ExperimentRuns);
    }

    [DockerTheory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Reanalyze_PreservesDecisionWindowAndAllocation(bool noData)
    {
        var run = await CreateRun(DateTime.UtcNow.AddDays(-1), null);
        var stats = new Mock<IExperimentStatsService>();
        stats.Setup(x => x.QueryAsync(It.IsAny<QueryExperimentStats>())).ReturnsAsync(new ExperimentStatsVm
        {
            Variants = noData ? [] :
            [
                new ExperimentVariantStatsVm { Variant = "control", Users = 100, Conversions = 10, SumValue = 10, SumSquares = 10 },
                new ExperimentVariantStatsVm { Variant = "treatment", Users = 100, Conversions = 20, SumValue = 20, SumSquares = 20 }
            ]
        });
        var flags = new Mock<IFeatureFlagService>();
        var service = fixture.CreateExperimentServices(provider, stats.Object, flags.Object).ExperimentService;
        await service.UpdateAsync(EnvId, run.ExperimentId, new ExperimentUpdate { FlagKey = "checkout" });
        await service.UpdateRunAsync(EnvId, run.ExperimentId, run.Id, new ExperimentRunUpdate
        {
            PrimaryMetricEvent = "purchase", ControlVariant = "control", TreatmentVariant = "treatment"
        });
        var before = await Allocation();

        for (var i = 0; i < 2; i++)
        {
            var analyzed = await service.AnalyzeRunAsync(EnvId, run.ExperimentId, run.Id,
                new ExperimentRunAnalyzeRequest { ForceFresh = true });
            var actual = Assert.Single(analyzed.ExperimentRuns);
            Assert.Equal("CONTINUE", actual.Decision);
            Assert.Equal(run.ObservationStart, actual.ObservationStart);
            Assert.Null(actual.ObservationEnd);
            Assert.False(string.IsNullOrWhiteSpace(actual.AnalysisResult));
            Assert.Equal(before.AllocationSummary.ReservedPercent, (await Allocation()).AllocationSummary.ReservedPercent);
        }

        Assert.All(flags.Invocations, invocation => Assert.Equal(nameof(IFeatureFlagService.GetAsync), invocation.Method.Name));
    }

    private async Task<ExperimentLayerReadResult> Allocation() => ExperimentLayerReadModel.Build(_layer,
        await Service().GetExperimentRunsByLayersAsync(EnvId, [_layer]));

    private static DateTime Day(int day) => DateTime.UtcNow.Date.AddYears(1).AddDays(day);

    private static async Task AssertConflict(Func<Task<ExperimentDetailVm>> action)
    {
        var error = await Assert.ThrowsAsync<BusinessException>(action);
        Assert.Equal(ErrorCodes.Conflict, error.Message);
    }
}
