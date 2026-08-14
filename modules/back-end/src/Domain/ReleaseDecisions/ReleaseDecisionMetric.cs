namespace Domain.ReleaseDecisions;

public class ReleaseDecisionMetric : AuditedEntity
{
    public Guid FeatBitEnvId { get; set; }

    public string Name { get; set; }

    public string Key { get; set; }

    public string Description { get; set; }

    public string MetricType { get; set; } = "binary";

    public string MetricAgg { get; set; } = "once";

    public string ExpectedDirection { get; set; } = "increase_good";

    public string Status { get; set; } = "active";
}
