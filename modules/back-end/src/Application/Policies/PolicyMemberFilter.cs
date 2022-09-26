using Application.Bases.Models;

namespace Application.Policies;

public class PolicyMemberFilter : PagedRequest
{
    public string SearchText { get; set; }

    public bool GetAllMembers { get; set; }
}