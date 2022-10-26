namespace Domain.Experiments;

public class Experiment : AuditedEntity
{
    public Guid EnvId { get; set; }
    public Guid MetricId { get; set; }
    public Guid FeatureFlagId { get; set; }
    
    public string Status { get; set; } // possible values: NotStarted, NotRecording, Recording

    public string BaselineVariationId { get; set; }
}