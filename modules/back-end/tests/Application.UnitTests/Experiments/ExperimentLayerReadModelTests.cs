using Application.Experiments;
using Application.Experiments.ExperimentLayers;
using Domain.Experiments;

namespace Application.UnitTests.Experiments;

public class ExperimentLayerReadModelTests
{
    [Fact]
    public void Build_ReturnsAllRunsAndUsesOnlyCurrentWindowsForAllocation()
    {
        var layer = NewLayer();
        var historical = NewRun(0, 50);
        historical.Run.ObservationEnd = DateTime.UtcNow.AddDays(-1);
        historical.Run.ObservationStart = DateTime.UtcNow.AddDays(-2);
        var current = NewRun(0, 60);
        var otherCurrent = NewRun(80, 90);
        var future = NewRun(0, 100);
        future.Run.ObservationStart = DateTime.UtcNow.AddDays(1);

        var result = ExperimentLayerReadModel.Build(layer, [historical, current, otherCurrent, future]);

        Assert.Equal(4, result.ExperimentRuns.Count);
        Assert.False(result.ExperimentRuns.Single(x => x.Id == historical.Run.Id).IncludedInAllocation);
        Assert.False(result.ExperimentRuns.Single(x => x.Id == future.Run.Id).IncludedInAllocation);
        Assert.True(result.ExperimentRuns.Single(x => x.Id == current.Run.Id).IncludedInAllocation);
        Assert.True(result.ExperimentRuns.Single(x => x.Id == otherCurrent.Run.Id).IncludedInAllocation);
        Assert.Equal(2, result.AllocationSummary.ActiveRunCount);
        Assert.Equal(70, result.AllocationSummary.ReservedPercent);
        Assert.Equal(30, result.AllocationSummary.FreePercent);
        Assert.Empty(result.AllocationSummary.Overlaps);
        Assert.Equal("no-conflicts", result.AllocationSummary.Status);
    }

    [Theory]
    [InlineData("CONTINUE")]
    [InlineData("PAUSE")]
    [InlineData("ROLLBACK")]
    [InlineData("INCONCLUSIVE")]
    public void Build_DecisionDoesNotChangeAllocation(string decision)
    {
        var run = NewRun(0, 30);
        run.Run.Decision = decision;
        var result = ExperimentLayerReadModel.Build(NewLayer(), [run]);

        Assert.Equal(30, result.AllocationSummary.ReservedPercent);
        Assert.True(Assert.Single(result.ExperimentRuns).IncludedInAllocation);
    }

    [Fact]
    public void Build_MergesSameExperimentBucketsAndDoesNotReportSelfOverlap()
    {
        var first = NewRun(0, 30);
        var second = NewRun(20, 50);
        var third = NewRun(70, 80);
        second.Run.ExperimentId = third.Run.ExperimentId = first.Run.ExperimentId;

        var result = ExperimentLayerReadModel.Build(NewLayer(), [first, second, third, first]);

        Assert.Equal(60, result.AllocationSummary.ReservedPercent);
        Assert.Equal(40, result.AllocationSummary.FreePercent);
        Assert.False(result.AllocationSummary.OverAllocated);
        Assert.Empty(result.AllocationSummary.Overlaps);
    }

    [Fact]
    public void Build_AdjacentWindowsSwitchReservationAtExclusiveEnd()
    {
        var boundary = new DateTime(2026, 9, 10, 0, 0, 0, DateTimeKind.Utc);
        var first = NewRun(0, 30);
        first.Run.ObservationStart = boundary.AddDays(-9);
        first.Run.ObservationEnd = boundary;
        var second = NewRun(0, 30);
        second.Run.ObservationStart = boundary;

        var result = ExperimentLayerReadModel.Build(NewLayer(), [first, second], boundary);

        Assert.Equal(30, result.AllocationSummary.ReservedPercent);
        Assert.Single(result.ExperimentRuns.Where(x => x.IncludedInAllocation), x => x.Id == second.Run.Id);
        Assert.Empty(result.AllocationSummary.Overlaps);
    }

    [Fact]
    public void Build_LegacyStartUsesCreationTimeAndIgnoresAnalysisUpdates()
    {
        var run = NewRun(0, 30);
        var now = DateTime.UtcNow;
        run.Run.CreatedAt = now.AddDays(-1);
        run.Run.ObservationStart = null;
        run.Run.UpdatedAt = now.AddDays(1);
        var result = ExperimentLayerReadModel.Build(NewLayer(), [run], now);

        Assert.Equal(run.Run.CreatedAt, Assert.Single(result.ExperimentRuns).ObservationStart);
        Assert.Equal(30, result.AllocationSummary.ReservedPercent);
    }

    [Fact]
    public void Build_ReturnsExactOverlapAndReservedCapacity()
    {
        var layer = NewLayer();
        var ranking = NewRun(0, 55);
        var coldStart = NewRun(50, 80);

        var result = ExperimentLayerReadModel.Build(layer, [ranking, coldStart]);

        Assert.Equal(85, result.AllocationSummary.ReservedPercent);
        Assert.Equal(15, result.AllocationSummary.FreePercent);
        var overlap = Assert.Single(result.AllocationSummary.Overlaps);
        Assert.Equal(50, overlap.Start);
        Assert.Equal(55, overlap.End);
        var expectedRunIds = new[] { ranking.Run.Id, coldStart.Run.Id }.OrderBy(x => x).ToArray();
        Assert.Equal(expectedRunIds, overlap.RunIds.ToArray());
        Assert.Equal("overlap", result.AllocationSummary.Status);
    }

    [Fact]
    public void Build_MixedAssignmentUnitTakesStatusPrecedence()
    {
        var layer = NewLayer();
        var first = NewRun(0, 70);
        var second = NewRun(60, 100);
        second.Run.AssignmentUnitSelector = "accountId";

        var result = ExperimentLayerReadModel.Build(layer, [first, second]);

        Assert.True(result.AllocationSummary.MixedAssignmentUnits);
        Assert.True(result.AllocationSummary.OverAllocated);
        Assert.Equal("mixed-assignment-units", result.AllocationSummary.Status);
    }

    [Fact]
    public void IsRunForLayer_SupportsLayerKeyWhenLayerIdIsMissing()
    {
        var layer = NewLayer();
        var run = NewRun(0, 50);
        run.Run.LayerId = null;
        run.Run.LayerKey = layer.Key;

        Assert.True(ExperimentLayerReadModel.IsRunForLayer(run.Run, layer));
    }

    [Fact]
    public void IsRunForLayer_DoesNotOverrideCanonicalLayerIdWithConflictingKey()
    {
        var layer = NewLayer();
        var run = NewRun(0, 50);
        run.Run.LayerId = Guid.NewGuid();
        run.Run.LayerKey = layer.Key;

        Assert.False(ExperimentLayerReadModel.IsRunForLayer(run.Run, layer));
    }

    private static ExperimentLayer NewLayer() => new()
    {
        Id = Guid.NewGuid(),
        Name = "Checkout",
        Key = "checkout",
        AssignmentUnitSelector = "user.keyId",
        Status = "active"
    };

    private static ExperimentRunForLayer NewRun(
        double start,
        double end)
    {
        return new ExperimentRunForLayer
        {
            ExperimentName = "Experiment",
            Run = new ExperimentRun
            {
                Id = Guid.NewGuid(),
                ExperimentId = Guid.NewGuid(),
                Slug = $"run-{Guid.NewGuid():N}",
                LayerKey = "checkout",
                AssignmentUnitSelector = "user.keyId",
                SliceStart = start,
                SliceEnd = end
            }
        };
    }
}
