using Application.Bases.Models;

namespace Application.Groups;

public class GroupPolicyFilter : PagedRequest
{
    public string? Name { get; set; }

    public bool GetAllPolicies { get; set; }
}