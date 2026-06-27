namespace Domain.ReleaseDecisions;

public class ReleaseDecisionActivity : Entity
{
    public string Type { get; set; }

    public string Title { get; set; }

    public string Detail { get; set; }

    public Guid? ActorId { get; set; }

    public string ActorName { get; set; }

    public string ActorEmail { get; set; }

    public string ActorType { get; set; }

    public DateTime CreatedAt { get; set; }

    public Guid ExperimentId { get; set; }

    public ReleaseDecisionExperiment Experiment { get; set; }
}
