#nullable enable
using Domain.FeatureFlags;

namespace Domain.SemanticPatch;

public class VariationComparer : IEqualityComparer<Variation>
{
    public bool Equals(Variation? x, Variation? y)
    {
        // Check for null values
        if (x == null || y == null)
            return false;

        // Check if the two Variation objects are the same reference
        if (ReferenceEquals(x, y))
            return true;

        // Compare the Id to determine if they're the same
        return x.Id == y.Id;
    }

    public int GetHashCode(Variation? obj)
    {
        if (obj == null || obj.Id == null)
            return 0;

        // Use the Id as the hash code
        return obj.Id.GetHashCode();
    }
}