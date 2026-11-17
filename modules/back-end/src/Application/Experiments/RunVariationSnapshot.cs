using Application.Bases;
using Application.Bases.Exceptions;
using Domain.Experiments;
using Domain.FeatureFlags;

namespace Application.Experiments;

public static class RunVariationSnapshot
{
    public static ICollection<Variation> Copy(IEnumerable<Variation> variations) =>
        (variations ?? []).Select(x => new Variation { Id = x.Id, Name = x.Name, Value = x.Value }).ToArray();

    public static string Selection(ExperimentRun run) =>
        System.Text.Json.JsonSerializer.Serialize(new { run.ControlVariant, Treatments = (run.TreatmentVariants ?? []).Order().ToArray() });

    public static void ValidateSelection(ExperimentRun run)
    {
        var ids = run.Variations.Select(x => x.Id).ToHashSet(StringComparer.Ordinal);
        if (string.IsNullOrWhiteSpace(run.ControlVariant) || !ids.Contains(run.ControlVariant))
            throw new BusinessException(ErrorCodes.Invalid("controlVariant"));
        var treatments = run.TreatmentVariants ?? [];
        if (treatments.Length == 0 || treatments.Distinct(StringComparer.Ordinal).Count() != treatments.Length ||
            treatments.Any(x => x == run.ControlVariant || !ids.Contains(x)))
            throw new BusinessException(ErrorCodes.Invalid("treatmentVariants"));
    }

    public static void EnsureSelectionCanChange(ExperimentRun run, string control, string[] treatments)
    {
        if (string.IsNullOrWhiteSpace(run.Decision)) return;
        var nextControl = control ?? run.ControlVariant;
        var nextTreatments = treatments ?? run.TreatmentVariants ?? [];
        if (nextControl != run.ControlVariant ||
            !nextTreatments.Order(StringComparer.Ordinal).SequenceEqual(
                (run.TreatmentVariants ?? []).Order(StringComparer.Ordinal)))
        {
            throw new BusinessException("experiment_run_decision_locks_variations");
        }
    }

    public static void InvalidateChangedSelection(ExperimentRun run, string previous)
    {
        if (Selection(run) == previous) return;
        run.AnalysisResult = null;
    }
}
