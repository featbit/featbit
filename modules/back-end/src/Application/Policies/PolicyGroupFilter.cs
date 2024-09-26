using Application.Bases.Models;

namespace Application.Policies;

public class PolicyGroupFilter : PagedRequest
{
    public string? Name { get; set; }

    public bool GetAllGroups { get; set; }
}