namespace Domain.Projects;

public class Project : AuditedEntity
{
    public Guid OrganizationId { get; set; }

    public string Name { get; set; }
}