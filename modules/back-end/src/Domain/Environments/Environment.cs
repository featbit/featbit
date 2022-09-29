namespace Domain.Environments;

public class Environment : AuditedEntity
{
    public Guid ProjectId { get; set; }

    public string Name { get; set; }

    public string Description { get; set; }

    public string Secret { get; set; }
}