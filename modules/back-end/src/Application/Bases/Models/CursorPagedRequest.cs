#nullable enable

namespace Application.Bases.Models;

public class CursorPagedRequest
{
    /// <summary>
    /// The cursor to be used for pagination. Default is null.
    /// </summary>
    public PageCursor? Cursor { get; set; }

    /// <summary>
    /// The size of the page to be returned. Default is 10.
    /// </summary>
    public int PageSize { get; set; } = 10;
}