namespace Domain.Projects;

public class Project : AuditedEntity
{
    public string OrganizationId { get; set; }

    public string Name { get; set; }
}