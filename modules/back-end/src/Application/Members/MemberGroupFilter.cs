using Application.Bases.Models;

namespace Application.Members;

public class MemberGroupFilter : PagedRequest
{
    public string Name { get; set; }

    public bool GetAllGroups { get; set; }
}