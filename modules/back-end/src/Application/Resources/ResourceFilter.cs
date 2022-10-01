using Application.Bases.Models;

namespace Application.Resources;

public class ResourceFilter : PagedRequest
{
    public string Type { get; set; }
    
    public string Name { get; set; }
}