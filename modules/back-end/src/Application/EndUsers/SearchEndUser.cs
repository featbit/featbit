using Application.Bases.Models;

namespace Application.EndUsers;

public class SearchEndUser : PagedRequest
{
    public string SearchText { get; set; }

    public List<string> Properties { get; set; }
}