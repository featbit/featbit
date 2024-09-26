using Application.Bases.Models;

namespace Application.EndUsers;

public class FeatureFlagEndUserFilter : PagedRequest
{
    public string? Query { get; set; }
    public string? FeatureFlagKey { get; set; }
    public string? VariationId { get; set; }
    public long From { get; set; }
    public long To { get; set; }
}