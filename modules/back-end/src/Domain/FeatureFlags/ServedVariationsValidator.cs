namespace Domain.FeatureFlags;

public static class ServedVariationsValidator
{
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
        if (!ordered[0].Rollout[0].Equals(0d) || !ordered[^1].Rollout[1].Equals(1d))
        {
            return false;
        }

        return ordered
            .Zip(
                ordered.Skip(1),
                (current, next) => current.Rollout[1].Equals(next.Rollout[0])
            )
            .All(isContinuous => isContinuous);
    }
}
