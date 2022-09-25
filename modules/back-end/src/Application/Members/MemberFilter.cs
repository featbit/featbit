using Application.Bases.Models;

namespace Application.Members;

public class MemberFilter : PagedRequest
{
    public string SearchText { get; set; }
}