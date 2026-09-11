using Application.Experiments;
using Domain.Experiments;

namespace Application.Experiments.ExperimentLayers;

public static class ExperimentLayerReadModel
{
    public static ExperimentLayerReadResult Build(
        ExperimentLayer layer,
        IEnumerable<ExperimentRunForLayer> sources,
        DateTime? now = null)
    {
        var instant = now ?? DateTime.UtcNow;
        var runs = sources
            .Select(source => ToRun(source, layer.AssignmentUnitSelector, instant))
            .OrderBy(x => x.Start)
            .ThenBy(x => x.ExperimentName)
            .ThenBy(x => x.Key)
            .ToArray();
        var activeRuns = runs.Where(x => x.IncludedInAllocation).ToArray();
        var reserved = activeRuns.GroupBy(x => x.ExperimentId).Sum(ReservedPercent);
        var overlaps = GetOverlaps(activeRuns);
        var layerAssignmentUnit = Normalize(layer.AssignmentUnitSelector) ?? "user.keyId";
        var mixedAssignmentUnits = activeRuns.Any(
            x => !string.Equals(
                Normalize(x.AssignmentUnitSelector) ?? "user.keyId",
                layerAssignmentUnit,
                StringComparison.Ordinal));
        var overAllocated = reserved > 100;

        var allocationSummary = new ExperimentLayerAllocationVm
        {
            ActiveRunCount = activeRuns.Length,
            ReservedPercent = Round(reserved),
            FreePercent = Round(Math.Max(0, 100 - reserved)),
            Overlaps = overlaps,
            MixedAssignmentUnits = mixedAssignmentUnits,
            OverAllocated = overAllocated,
            Status = mixedAssignmentUnits
                ? "mixed-assignment-units"
                : overAllocated
                    ? "over-allocated"
                    : overlaps.Count > 0
                        ? "overlap"
                        : "no-conflicts"
        };

        return new ExperimentLayerReadResult(runs, allocationSummary);
    }

    public static bool IsRunForLayer(
        ExperimentRun run,
        ExperimentLayer layer)
    {
        if (run.LayerId.HasValue)
        {
            return run.LayerId.Value == layer.Id;
        }

        return string.Equals(
            run.LayerKey?.Trim(),
            layer.Key,
            StringComparison.Ordinal);
    }

    private static ExperimentLayerRunVm ToRun(
        ExperimentRunForLayer source,
        string layerAssignmentUnit,
        DateTime instant)
    {
        var run = source.Run;
        var (start, end) = ExperimentRunAllocation.Slice(run);
        var included = ExperimentRunAllocation.Includes(run, instant) && end > start;

        return new ExperimentLayerRunVm
        {
            Id = run.Id,
            ExperimentId = run.ExperimentId,
            ExperimentName = Normalize(source.ExperimentName) ?? "Experiment",
            Key = Normalize(run.Slug) ?? run.Id.ToString("D"),
            LayerId = run.LayerId,
            LayerKey = Normalize(run.LayerKey),
            AssignmentUnitSelector = Normalize(
                run.AssignmentUnitSelector,
                run.AllocationKeySelector) ?? Normalize(layerAssignmentUnit) ?? "user.keyId",
            Start = Round(start),
            End = Round(end),
            ObservationStart = ExperimentRunAllocation.ObservationStart(run),
            ObservationEnd = run.ObservationEnd,
            IncludedInAllocation = included
        };
    }

    private static List<ExperimentLayerOverlapVm> GetOverlaps(
        IReadOnlyCollection<ExperimentLayerRunVm> runs)
    {
        var boundaries = runs
            .SelectMany(x => new[] { x.Start, x.End })
            .Distinct()
            .OrderBy(x => x)
            .ToArray();
        var overlaps = new List<ExperimentLayerOverlapVm>();

        for (var index = 0; index < boundaries.Length - 1; index++)
        {
            var start = boundaries[index];
            var end = boundaries[index + 1];
            if (end <= start)
            {
                continue;
            }

            var coveringRuns = runs
                .Where(x => x.Start < end && start < x.End)
                .ToArray();
            if (coveringRuns.Select(x => x.ExperimentId).Distinct().Count() < 2)
            {
                continue;
            }

            var runIds = coveringRuns
                .Select(x => x.Id)
                .OrderBy(x => x)
                .ToArray();

            var previous = overlaps.LastOrDefault();
            if (previous != null &&
                previous.End == start &&
                previous.RunIds.SequenceEqual(runIds))
            {
                previous.End = Round(end);
            }
            else
            {
                overlaps.Add(new ExperimentLayerOverlapVm
                {
                    Start = Round(start),
                    End = Round(end),
                    RunIds = runIds
                });
            }
        }

        return overlaps;
    }

    private static double ReservedPercent(IEnumerable<ExperimentLayerRunVm> runs)
    {
        double reserved = 0, previousEnd = 0;
        foreach (var run in runs.OrderBy(x => x.Start))
        {
            reserved += Math.Max(0, run.End - Math.Max(run.Start, previousEnd));
            previousEnd = Math.Max(previousEnd, run.End);
        }

        return reserved;
    }

    private static double Round(double value) =>
        Math.Round(value, 4, MidpointRounding.AwayFromZero);

    private static string Normalize(string value, string fallback = null) =>
        string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
}

public class ExperimentLayerReadResult(
    IReadOnlyCollection<ExperimentLayerRunVm> experimentRuns,
    ExperimentLayerAllocationVm allocationSummary)
{
    public IReadOnlyCollection<ExperimentLayerRunVm> ExperimentRuns { get; } = experimentRuns;

    public ExperimentLayerAllocationVm AllocationSummary { get; } = allocationSummary;
}
