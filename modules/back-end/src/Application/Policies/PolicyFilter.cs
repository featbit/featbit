using Application.Bases.Models;

namespace Application.Policies;

public class PolicyFilter : PagedRequest
{
    /// <summary>
    /// The name or part of the name of a policy
    /// </summary>
    public string Name { get; set; }
}