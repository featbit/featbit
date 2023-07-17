namespace Domain.Projects;

public class Project : AuditedEntity
{
    public Guid OrganizationId { get; set; }

    public string Name { get; set; }

    public string Key { get; set; }

    public Project(Guid organizationId, string name, string key)
    {
        OrganizationId = organizationId;
        Name = name;
        Key = key;
    }

    public void Update(string name)
    {
        Name = name;

        UpdatedAt = DateTime.UtcNow;
    }
}