using Application.Bases.Models;

namespace Application.Groups;

public class GroupFilter : PagedRequest
{
    public string? Name { get; set; }
}