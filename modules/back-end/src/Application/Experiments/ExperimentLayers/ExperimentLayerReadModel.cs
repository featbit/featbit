using Application.Experiments;
using Domain.Experiments;

namespace Application.Experiments.ExperimentLayers;

public static class ExperimentLayerReadModel
{
    private static readonly HashSet<string> ActiveRunStatuses =
        new(StringComparer.OrdinalIgnoreCase) { "draft", "collecting", "analyzing" };

    public static ExperimentLayerReadResult Build(
        ExperimentLayer layer,
        IEnumerable<ExperimentRunForLayer> sources)
    {
        var runs = sources
            .Select(source => ToRun(source, layer.AssignmentUnitSelector))
            .OrderBy(x => x.Start)
            .ThenBy(x => x.ExperimentName)
            .ThenBy(x => x.Key)
            .ToArray();
        var activeRuns = runs.Where(x => x.IncludedInAllocation).ToArray();
        var reserved = activeRuns.Sum(x => x.End - x.Start);
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
        if (Guid.TryParse(run.LayerId, out var layerId))
        {
            return layerId == layer.Id;
        }

        var legacyLayerKey = string.IsNullOrWhiteSpace(run.LayerKey)
            ? run.LayerId
            : run.LayerKey;
        return string.Equals(
            legacyLayerKey?.Trim(),
            layer.Key,
            StringComparison.Ordinal);
    }

    private static ExperimentLayerRunVm ToRun(
        ExperimentRunForLayer source,
        string layerAssignmentUnit)
    {
        var run = source.Run;
        var start = Clamp(run.SliceStart ?? run.TrafficOffset ?? 0);
        var fallbackWidth = Math.Max(0, run.LayerTrafficPercent ?? run.TrafficPercent ?? 100);
        var end = Clamp(run.SliceEnd ?? (start + fallbackWidth));
        var status = Normalize(run.Status) ?? "draft";
        var included = ActiveRunStatuses.Contains(status) && end > start;

        return new ExperimentLayerRunVm
        {
            Id = run.Id,
            ExperimentId = run.ExperimentId,
            ExperimentName = Normalize(source.ExperimentName) ?? "Experiment",
            Key = Normalize(run.Slug, run.RunId) ?? run.Id.ToString("D"),
            LayerId = Normalize(run.LayerId),
            LayerKey = Normalize(run.LayerKey),
            AssignmentUnitSelector = Normalize(
                run.AssignmentUnitSelector,
                run.AllocationKeySelector) ?? Normalize(layerAssignmentUnit) ?? "user.keyId",
            Start = Round(start),
            End = Round(end),
            Status = status,
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

            var runIds = runs
                .Where(x => x.Start < end && start < x.End)
                .Select(x => x.Id)
                .OrderBy(x => x)
                .ToArray();
            if (runIds.Length < 2)
            {
                continue;
            }

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

    private static double Clamp(double value) => Math.Max(0, Math.Min(100, value));

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
