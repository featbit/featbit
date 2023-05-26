using Application.Bases.Models;

namespace Application.RelayProxies;

public class RelayProxyFilter : PagedRequest
{
    public string Name { get; set; }
}