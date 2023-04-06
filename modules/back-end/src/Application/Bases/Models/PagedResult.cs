namespace Application.Bases.Models;

public class PagedResult<TValue>
{
    /// <summary>
    /// Total number of items matching the filter
    /// </summary>
    public long TotalCount { get; set; }

    /// <summary>
    /// The list of items of the current page
    /// </summary>
    public IReadOnlyList<TValue> Items { get; set; }

    public PagedResult(long totalCount, IReadOnlyList<TValue> items)
    {
        TotalCount = totalCount;
        Items = items;
    }
}