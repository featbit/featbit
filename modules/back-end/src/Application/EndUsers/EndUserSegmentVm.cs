using Domain.Segments;

namespace Application.EndUsers;

public class EndUserSegmentVm
{
    public string Id { get; set; }

    public string Name { get; set; }

    public DateTime UpdatedAt { get; set; }

    public EndUserSegmentVm(Segment segment)
    {
        Id = segment.Id.ToString();
        Name = segment.Name;
        UpdatedAt = segment.UpdatedAt;
    }
}