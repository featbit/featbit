using Application.Bases.Models;

namespace Application.EndUsers;

public class SearchEndUser : PagedRequest
{
    public string SearchText { get; set; }

    public List<string> Properties { get; set; }

    public string[] ExcludedKeyIds { get; set; }

    public bool? IncludeGlobalUser { get; set; }
}