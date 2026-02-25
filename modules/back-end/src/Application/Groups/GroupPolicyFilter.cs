using Application.Bases.Models;

namespace Application.Groups;

public class GroupPolicyFilter : PagedRequest
{
    /// <summary>
    /// The name or part of the name of a policy
    /// </summary>
    public string Name { get; set; }

    /// <summary>
    /// Whether to filter on all policies of the current organization
    /// </summary>
    /// <remarks>
    /// True if you want to filter on all policies of the current organization,
    /// False if you want to filter only on the policies of the current group.
    /// </remarks>
    public bool GetAllPolicies { get; set; }
}