using Application.Bases.Models;

namespace Application.ChangeRequests;

public class ChangeRequestFilter : PagedRequest
{
    /// <summary>
    /// The comment or part of the comment of a change request.
    /// </summary>
    public string Query { get; set; }

    /// <summary>
    /// Return only change requests created by this member.
    /// </summary>
    public Guid? CreatorId { get; set; }

    /// <summary>
    /// Return only change requests assigned to this reviewer.
    /// </summary>
    public Guid? ReviewerId { get; set; }

    /// <summary>
    /// Return only change requests with this status.
    /// </summary>
    public string Status { get; set; }
}
