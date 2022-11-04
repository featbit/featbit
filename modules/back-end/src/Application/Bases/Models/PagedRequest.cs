namespace Application.Bases.Models;

public class PagedRequest
{
    public int PageIndex { get; set; } = 0;

    // PageSize == -1 means no pagination
    public int PageSize { get; set; } = 10;
}