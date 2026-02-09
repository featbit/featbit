using Application.Bases.Models;

namespace Application.Groups;

public class GroupFilter : PagedRequest
{
    /// <summary>
    /// The name or part of the name of a group
    /// </summary>
    public string Name { get; set; }
}