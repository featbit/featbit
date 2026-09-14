using Application.Bases;
using Application.Bases.Exceptions;
using Domain.Experiments;

namespace Application.Experiments;

/// <summary>Layer reservations use observation time and buckets; decisions do not change reservations.</summary>
public static class ExperimentRunAllocation
{
    // Stable compatibility default for legacy runs without a start. Never use UpdatedAt or now:
    // analyzing or editing a run must not move its reservation.
    public static DateTime ObservationStart(ExperimentRun run) => run.ObservationStart ?? run.CreatedAt;

    public static void NormalizeAndValidateWindow(ExperimentRun run)
    {
        var start = ObservationStart(run);
        if (start == default)
        {
            throw new BusinessException(ErrorCodes.Required("observationStart"));
        }

        if (run.ObservationEnd.HasValue && run.ObservationEnd.Value <= start)
        {
            throw new BusinessException(ErrorCodes.Invalid("observationEnd"));
        }

        run.ObservationStart = start;
    }

    public static bool Includes(ExperimentRun run, DateTime instant) =>
        ObservationStart(run) <= instant && (!run.ObservationEnd.HasValue || instant < run.ObservationEnd.Value);

    public static bool WindowsOverlap(ExperimentRun left, ExperimentRun right) =>
        (!right.ObservationEnd.HasValue || ObservationStart(left) < right.ObservationEnd.Value) &&
        (!left.ObservationEnd.HasValue || ObservationStart(right) < left.ObservationEnd.Value);

    public static (double Start, double End) Slice(ExperimentRun run)
    {
        var start = Math.Clamp(run.SliceStart ?? run.TrafficOffset ?? 0, 0d, 100d);
        var width = Math.Max(0, run.LayerTrafficPercent ?? run.TrafficPercent ?? 100);
        var end = Math.Clamp(run.SliceEnd ?? start + width, 0d, 100d);
        return (start, end);
    }

    public static bool SameLayer(ExperimentRun left, ExperimentRun right) =>
        left.LayerId.HasValue && right.LayerId.HasValue
            ? left.LayerId == right.LayerId
            : !string.IsNullOrWhiteSpace(left.LayerKey) &&
              string.Equals(left.LayerKey.Trim(), right.LayerKey?.Trim(), StringComparison.Ordinal);

    public static void ValidateReservation(ExperimentRun run, IEnumerable<ExperimentRun> candidates)
    {
        var (start, end) = Slice(run);
        foreach (var candidate in candidates)
        {
            if (candidate.ExperimentId == run.ExperimentId || !SameLayer(run, candidate))
            {
                continue;
            }

            // An invalid legacy window must be repaired rather than silently releasing its buckets.
            NormalizeAndValidateWindow(candidate);
            if (!WindowsOverlap(run, candidate))
            {
                continue;
            }

            if (!string.Equals(AssignmentUnit(run), AssignmentUnit(candidate), StringComparison.Ordinal))
            {
                throw new BusinessException(ErrorCodes.Invalid("assignmentUnitSelector"));
            }

            var (candidateStart, candidateEnd) = Slice(candidate);
            if (end > start && candidateEnd > candidateStart &&
                candidateStart < end && start < candidateEnd)
            {
                throw new BusinessException(ErrorCodes.Conflict);
            }
        }
    }

    private static string AssignmentUnit(ExperimentRun run) =>
        !string.IsNullOrWhiteSpace(run.AssignmentUnitSelector) ? run.AssignmentUnitSelector.Trim() :
        !string.IsNullOrWhiteSpace(run.AllocationKeySelector) ? run.AllocationKeySelector.Trim() : "user.keyId";
}
