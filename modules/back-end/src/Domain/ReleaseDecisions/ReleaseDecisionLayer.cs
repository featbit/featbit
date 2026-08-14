namespace Domain.ReleaseDecisions;

public class ReleaseDecisionLayer : AuditedEntity
{
    public Guid FeatBitEnvId { get; set; }

    public string Name { get; set; }

    public string Key { get; set; }

    public string Description { get; set; }

    public string AssignmentUnitSelector { get; set; } = "user.keyId";

    public string Status { get; set; } = "active";
}
