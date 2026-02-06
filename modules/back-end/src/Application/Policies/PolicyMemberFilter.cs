using Application.Bases.Models;

namespace Application.Policies;

public class PolicyMemberFilter : PagedRequest
{
    /// <summary>
    /// The email or part of the email of a user
    /// </summary>
    public string SearchText { get; set; }

    /// <summary>
    /// Whether to filter on all member users of the current organization
    /// </summary>
    /// <remarks>
    /// True if you want to filter on all member users of the current organization,
    /// False if you want to filter only on the member users that the current policy is assigned to.
    /// </remarks>
    public bool GetAllMembers { get; set; }
}