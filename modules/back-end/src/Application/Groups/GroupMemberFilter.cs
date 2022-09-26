using Application.Bases.Models;

namespace Application.Groups;

public class GroupMemberFilter : PagedRequest
{
    public string SearchText { get; set; }

    public bool GetAllMembers { get; set; }
}