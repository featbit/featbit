namespace Application.Segments;

public class SegmentVm
{
    public string Id { get; set; }

    public string Name { get; set; }

    public string Type { get; set; }

    public ICollection<string> Scopes { get; set; }

    public string Description { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}