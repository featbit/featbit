using Application.Bases.Models;

namespace Application.AccessTokens;

public class AccessTokenFilter : PagedRequest
{
    public string Name { get; set; }

    public Guid? CreatorId { get; set; }

    public string Type { get; set; }
}