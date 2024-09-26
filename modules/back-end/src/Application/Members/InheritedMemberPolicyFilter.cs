using Application.Bases.Models;

namespace Application.Members;

public class InheritedMemberPolicyFilter : PagedRequest
{
    public string? Name { get; set; }
}