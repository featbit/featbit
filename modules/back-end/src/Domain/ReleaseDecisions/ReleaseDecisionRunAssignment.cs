namespace Domain.ReleaseDecisions;

public class ReleaseDecisionRunAssignment : Entity
{
    public Guid RunId { get; set; }

    public Guid EnvId { get; set; }

    public string FlagKey { get; set; }

    public string AllocationKey { get; set; }

    public string AssignmentUnit { get; set; }

    public string UserKey { get; set; }

    public string ExpectedVariationId { get; set; }

    public string ActualVariationId { get; set; }

    public string Role { get; set; }

    public string AnalysisRole { get; set; }

    public double Bucket { get; set; }

    public double? LayerBucket { get; set; }

    public double? SamplingBucket { get; set; }

    public bool IncludedBySampling { get; set; } = true;

    public string ExclusionReason { get; set; }

    public DateTime AssignedAt { get; set; }

    public DateTime FirstExposedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}
