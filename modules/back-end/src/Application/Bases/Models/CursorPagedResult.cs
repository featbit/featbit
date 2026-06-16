#nullable enable

namespace Application.Bases.Models;

public class CursorPagedResult<TValue>
{
    /// <summary>
    /// The list of items in the current page.
    /// </summary>
    public IReadOnlyList<TValue> Items { get; set; } = [];

    /// <summary>
    /// The cursor for the previous page. Null if there are no previous pages.
    /// </summary>
    public PageCursor? PreviousCursor { get; set; }

    /// <summary>
    /// The cursor for the next page. Null if there are no more pages.
    /// </summary>
    public PageCursor? NextCursor { get; set; }

    public CursorPagedResult(IReadOnlyList<TValue> items, PageCursor? previousCursor, PageCursor? nextCursor)
    {
        Items = items;
        PreviousCursor = previousCursor;
        NextCursor = nextCursor;
    }
}