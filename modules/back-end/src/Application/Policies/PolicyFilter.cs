using Application.Bases.Models;

namespace Application.Policies;

public class PolicyFilter : PagedRequest
{
    public string? Name { get; set; }
}