namespace Application.Bases.Models;

public class PagedRequest
{
    public int PageIndex { get; set; } = 0;

    public int PageSize { get; set; } = 10;
}