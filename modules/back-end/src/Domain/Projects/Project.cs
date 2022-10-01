namespace Domain.Projects;

public class Project : AuditedEntity
{
    public Guid OrganizationId { get; set; }

    public string Name { get; set; }

    public Project(Guid organizationId, string name)
    {
        OrganizationId = organizationId;
        Name = name;
    }

    public void Update(string name)
    {
        Name = name;
        
        UpdatedAt = DateTime.UtcNow;
    }
}