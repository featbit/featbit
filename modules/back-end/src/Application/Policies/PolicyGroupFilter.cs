using Application.Bases.Models;

namespace Application.Policies;

public class PolicyGroupFilter : PagedRequest
{
    /// <summary>
    /// The name or part of the name of a group
    /// </summary>
    public string Name { get; set; }

    /// <summary>
    /// Whether to filter on all groups of the current organization
    /// </summary>
    /// <remarks>
    /// True if you want to filter on all groups of the current organization,
    /// False if you want to filter only on the groups containing the current policy.
    /// </remarks>
    public bool GetAllGroups { get; set; }
}