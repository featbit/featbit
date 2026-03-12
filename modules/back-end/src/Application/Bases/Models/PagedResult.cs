using Application.EndUsers;

namespace Application.Bases.Models;

/// <summary>
/// Represents a paged result of items.
/// </summary>
/// <typeparam name="TValue">The type of the items.</typeparam>
public class PagedResult<TValue>
{
    /// <summary>
    /// The total count of items.
    /// </summary>
    public long TotalCount { get; set; }

    /// <summary>
    /// The items in the current page.
    /// </summary>
    public IReadOnlyList<TValue> Items { get; set; }

    public PageCursor NextCursor { get; set; }
    
    public PageCursor PreviousCursor { get; set; }

    /// <summary>
    /// Initializes a new instance of the <see cref="PagedResult{TValue}"/> class.
    /// </summary>
    /// <param name="totalCount">The total count of items.</param>
    /// <param name="items">The items in the current page.</param>
    public PagedResult(long totalCount, IReadOnlyList<TValue> items)
    {
        TotalCount = totalCount;
        Items = items;
    }
    
    /// <summary>
    /// Initializes a new instance of the <see cref="PagedResult{TValue}"/> class.
    /// </summary>
    /// <param name="items">The items in the current page.</param>
    /// <param name="nextCursor">The next cursor for pagination</param>
    /// <param name="previousCursor">The previous cursor for pagination</param>
    public PagedResult(IReadOnlyList<TValue> items, PageCursor nextCursor, PageCursor previousCursor)
    {
        Items = items;
        NextCursor = nextCursor;
        PreviousCursor = previousCursor;
    }
}