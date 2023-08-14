#nullable enable
using Domain.FeatureFlags;

namespace Domain.SemanticPatch;

public class RolloutVariationComparer : IEqualityComparer<RolloutVariation>
{
    public bool Equals(RolloutVariation? x, RolloutVariation? y)
    {
        // Check for null values
        if (x == null || y == null)
            return false;

        // Check if the two RolloutVariation objects are the same reference
        if (ReferenceEquals(x, y))
            return true;

        // Compare the Id to determine if they're the same
        return x.Id == y.Id;
    }

    public int GetHashCode(RolloutVariation? obj)
    {
        if (obj == null || obj.Id == null)
            return 0;

        // Use the Id as the hash code
        return obj.Id.GetHashCode();
    }
}