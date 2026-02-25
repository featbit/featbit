using Application.Bases.Models;

namespace Application.Segments;

public class SegmentFilter : PagedRequest
{
    /// <summary>
    /// The name or part of the name of a segment
    /// </summary>
    public string Name { get; set; }

    /// <summary>
    /// Return only archived segments if true, the default value is false
    /// </summary>
    public bool IsArchived { get; set; }
}