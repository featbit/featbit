namespace Application.Bases.Models;

public class PagedRequest
{
    /// <summary>
    /// The index of the page to be returned. Default is 0.
    /// </summary>
    public int PageIndex { get; set; } = 0;

    /// <summary>
    /// The size of the page to be returned. Default is 10.
    /// </summary>
    public int PageSize { get; set; } = 10;
    
    /// <summary>
    /// The cursor to be used for pagination when using cursor-based pagination.
    /// </summary>
    public PageCursor Cursor { get; set; }
}