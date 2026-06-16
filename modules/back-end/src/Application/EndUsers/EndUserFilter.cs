using Application.Bases.Models;

namespace Application.EndUsers;

public class EndUserFilter : CursorPagedRequest
{
    public string SearchText { get; set; }
}