namespace Application.Bases.Models;

public class PagedResult<TValue>
{
    public long TotalCount { get; set; }

    public IReadOnlyList<TValue> Items { get; set; }

    public PagedResult(long totalCount, IReadOnlyList<TValue> items)
    {
        TotalCount = totalCount;
        Items = items;
    }
}