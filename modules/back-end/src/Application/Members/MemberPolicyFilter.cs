using Application.Bases.Models;

namespace Application.Members;

public class MemberPolicyFilter : PagedRequest
{
    public string Name { get; set; }

    public bool GetAllPolicies { get; set; }
}