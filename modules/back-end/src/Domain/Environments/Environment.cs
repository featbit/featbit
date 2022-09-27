namespace Domain.Environments;

public class Environment : AuditedEntity
{
    public string ProjectId { get; set; }

    public string Name { get; set; }

    public string Description { get; set; }

    public string Secret { get; set; }
}