namespace Domain.Experiments;

public class ExperimentMetricEvent : Entity
{
    public Guid EnvId { get; set; }

    public string UserKey { get; set; }

    public string EventName { get; set; }

    public string EventType { get; set; }

    public double NumericValue { get; set; }

    public string ApplicationType { get; set; }

    public DateTime OccurredAt { get; set; }

    public DateTime CreatedAt { get; set; }
}
