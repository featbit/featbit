using Domain.FeatureFlags;

namespace Application.FeatureFlags;

public class ScheduleWithChangeRequestParam
{
    public FlagTargeting Targeting { get; set; }

    public string Title { get; set; }

    public DateTime ScheduledTime { get; set; }

    public bool WithChangeRequest { get; set; }

    public string Reason { get; set; }

    public ICollection<Guid> Reviewers { get; set; }
}