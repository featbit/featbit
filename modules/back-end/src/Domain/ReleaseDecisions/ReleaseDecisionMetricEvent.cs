namespace Domain.ReleaseDecisions;

public class ReleaseDecisionMetricEvent : Entity
{
    public Guid EnvId { get; set; }

    public string UserKey { get; set; }

    public string EventName { get; set; }

    public string EventType { get; set; }

    public double NumericValue { get; set; }

    public DateTime OccurredAt { get; set; }

    public string Properties { get; set; }

    public DateTime CreatedAt { get; set; }
}
