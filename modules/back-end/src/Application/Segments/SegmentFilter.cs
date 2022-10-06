using Application.Bases.Models;

namespace Application.Segments;

public class SegmentFilter : PagedRequest
{
    public string Name { get; set; }
}