namespace Domain.Experiments;

public class Experiment : AuditedEntity
{
    public string Name { get; set; }

    public string Description { get; set; }

    public string Stage { get; set; } = "hypothesis";

    public string FlagKey { get; set; }

    public string ProjectKey { get; set; }

    public Guid? EnvId { get; set; }

    public string Hypothesis { get; set; }

    public string AccessToken { get; set; }

    public string Change { get; set; }

    public string Constraints { get; set; }

    public string EnvSecret { get; set; }

    public string FlagServerUrl { get; set; }

    public string Goal { get; set; }

    public string Guardrails { get; set; }

    public string Intent { get; set; }

    public string LastAction { get; set; }

    public string LastLearning { get; set; }

    public string OpenQuestions { get; set; }

    public string PrimaryMetric { get; set; }

    public string SandboxId { get; set; }

    public string SandboxStatus { get; set; } = "idle";

    public string Variants { get; set; }

    public string ConflictAnalysis { get; set; }

    public string EntryMode { get; set; }

    // Null marks legacy data whose run history has not been used to seed the counter yet.
    // Only the database allocator updates this value; deleting a run never resets it.
    public long? LastRunNumber { get; set; }

    public ICollection<ExperimentRun> ExperimentRuns { get; set; } = [];

    public ICollection<ExperimentActivity> Activities { get; set; } = [];
}
