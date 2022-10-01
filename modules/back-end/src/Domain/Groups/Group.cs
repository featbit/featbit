namespace Domain.Groups;

public class Group : AuditedEntity
{
    public Guid OrganizationId { get; set; }

    public string Name { get; set; }

    public string Description { get; set; }

    public Group(Guid organizationId, string name, string description)
    {
        OrganizationId = organizationId;
        Name = name;
        Description = description;
    }

    public void Update(string name, string description)
    {
        Name = name;
        Description = description;

        UpdatedAt = DateTime.UtcNow;
    }
}