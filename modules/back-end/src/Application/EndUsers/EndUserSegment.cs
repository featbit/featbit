using Domain.Segments;

namespace Application.EndUsers;

public class EndUserSegment
{
    public string Id { get; set; }

    public string Name { get; set; }

    public DateTime UpdatedAt { get; set; }

    public EndUserSegment(Segment segment)
    {
        Id = segment.Id.ToString();
        Name = segment.Name;
        UpdatedAt = segment.UpdatedAt;
    }
}