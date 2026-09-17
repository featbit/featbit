namespace Domain.Experiments;

public class ExperimentMetric : AuditedEntity
{
    public Guid EnvId { get; set; }

    public string Name { get; set; }

    public string Key { get; set; }

    public string EventName { get; set; }

    public string Description { get; set; }

    public string MetricType { get; set; } = "binary";

    public string MetricAgg { get; set; } = "once";

    public string Status { get; set; } = "active";
}
