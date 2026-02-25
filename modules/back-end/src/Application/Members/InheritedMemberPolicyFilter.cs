using Application.Bases.Models;

namespace Application.Members;

public class InheritedMemberPolicyFilter : PagedRequest
{
    /// <summary>
    /// The name or part of the name of a policy
    /// </summary>
    public string Name { get; set; }
}