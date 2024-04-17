using Application.Bases.Models;

namespace Application.GlobalUsers;

public class GlobalUserFilter : PagedRequest
{
    public string Name { get; set; }
}