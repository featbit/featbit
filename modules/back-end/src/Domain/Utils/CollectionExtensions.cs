namespace Domain.Utils;

public static class CollectionExtensions
{
    public static bool AreEquivalent<T>(this ICollection<T> source, ICollection<T> destination)
    {
        if (source == null && destination == null)
        {
            // both are null, consider them equivalent
            return true;
        }

        if (source == null || destination == null)
        {
            // one is null, the other is not, not equivalent
            return false;
        }

        if (ReferenceEquals(source, destination))
        {
            // both reference the same object, consider them equivalent
            return true;
        }

        if (source.Count != destination.Count)
        {
            // different counts, not equivalent
            return false;
        }

        if (source.Count == 0)
        {
            // both are empty, consider them equivalent
            return true;
        }

        // not the most efficient way, but works for most cases
        var orderedSrc = source.OrderBy(x => x);
        var orderedDest = destination.OrderBy(x => x);

        return orderedSrc.SequenceEqual(orderedDest);
    }
}