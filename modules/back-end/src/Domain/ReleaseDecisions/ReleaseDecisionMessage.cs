namespace Domain.ReleaseDecisions;

public class ReleaseDecisionMessage : Entity
{
    public string Role { get; set; }

    public string Content { get; set; }

    public string Metadata { get; set; }

    public DateTime CreatedAt { get; set; }

    public Guid ExperimentId { get; set; }

    public ReleaseDecisionExperiment Experiment { get; set; }
}
