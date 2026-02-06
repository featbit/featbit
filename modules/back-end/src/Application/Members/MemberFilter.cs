using Application.Bases.Models;

namespace Application.Members;

public class MemberFilter : PagedRequest
{
    /// <summary>
    /// The email or part of the email of a user
    /// </summary>
    public string SearchText { get; set; }
}