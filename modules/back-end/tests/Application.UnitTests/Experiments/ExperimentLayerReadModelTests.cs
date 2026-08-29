using Application.Experiments;
using Application.Experiments.ExperimentLayers;
using Domain.Experiments;

namespace Application.UnitTests.Experiments;

public class ExperimentLayerReadModelTests
{
    [Fact]
    public void Build_ReturnsAllRunsAndExcludesArchivedRunFromAllocation()
    {
        var layer = NewLayer();
        var archived = NewRun("archived", 0, 50);
        var collecting = NewRun("collecting", 0, 60);
        var draft = NewRun("draft", 80, 90);

        var result = ExperimentLayerReadModel.Build(layer, [archived, collecting, draft]);

        Assert.Equal(3, result.ExperimentRuns.Count);
        Assert.False(result.ExperimentRuns.Single(x => x.Id == archived.Run.Id).IncludedInAllocation);
        Assert.True(result.ExperimentRuns.Single(x => x.Id == collecting.Run.Id).IncludedInAllocation);
        Assert.True(result.ExperimentRuns.Single(x => x.Id == draft.Run.Id).IncludedInAllocation);
        Assert.Equal(2, result.AllocationSummary.ActiveRunCount);
        Assert.Equal(70, result.AllocationSummary.ReservedPercent);
        Assert.Equal(30, result.AllocationSummary.FreePercent);
        Assert.Empty(result.AllocationSummary.Overlaps);
        Assert.Equal("no-conflicts", result.AllocationSummary.Status);
    }

    [Fact]
    public void Build_ReturnsExactOverlapAndReservedCapacity()
    {
        var layer = NewLayer();
        var ranking = NewRun("collecting", 0, 55);
        var coldStart = NewRun("analyzing", 50, 80);

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
        var first = NewRun("collecting", 0, 70);
        var second = NewRun("draft", 60, 100);
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
        var run = NewRun("draft", 0, 50);
        run.Run.LayerId = null;
        run.Run.LayerKey = layer.Key;

        Assert.True(ExperimentLayerReadModel.IsRunForLayer(run.Run, layer));
    }

    [Fact]
    public void IsRunForLayer_DoesNotOverrideCanonicalLayerIdWithConflictingKey()
    {
        var layer = NewLayer();
        var run = NewRun("draft", 0, 50);
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
        string status,
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
                SliceEnd = end,
                Status = status
            }
        };
    }
}
