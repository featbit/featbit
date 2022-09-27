namespace Domain.Policies;

public class Policy : AuditedEntity
{
    public string OrganizationId { get; set; }

    public string Name { get; set; }

    public string Description { get; set; }

    public string Type { get; set; }

    public ICollection<PolicyStatement> Statements { get; set; }
}