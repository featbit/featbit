namespace Domain.FeatureFlags;

public static class ServedVariationsValidator
{
    private const double Tolerance = 0.00001;

    public static bool IsValid(ICollection<RolloutVariation> servedVariations, ICollection<Variation> flagVariations)
    {
        if (servedVariations == null || servedVariations.Count == 0)
        {
            return false;
        }

        if (servedVariations.Any(variation => variation == null || !variation.IsValid(flagVariations)))
        {
            return false;
        }

        var ordered = servedVariations.OrderBy(variation => variation.Rollout[0]).ToArray();
        if (Math.Abs(ordered[0].Rollout[0]) > Tolerance || Math.Abs(ordered[^1].Rollout[1] - 1) > Tolerance)
        {
            return false;
        }

        return ordered.Zip(ordered.Skip(1), (current, next) =>
            Math.Abs(current.Rollout[1] - next.Rollout[0]) <= Tolerance).All(isContinuous => isContinuous);
    }
}
