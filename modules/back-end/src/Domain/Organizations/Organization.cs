namespace Domain.Organizations;

public class Organization : AuditedEntity
{
    public Guid WorkspaceId { get; set; }

    public string Name { get; set; }

    public bool Initialized { get; set; }

    public string License { get; set; }

    public Organization(Guid workspaceId, string name)
    {
        WorkspaceId = workspaceId;
        Name = name;
        Initialized = false;
        License = string.Empty;
    }

    public void UpdateName(string name)
    {
        Name = name;

        UpdatedAt = DateTime.UtcNow;
    }

    public void Initialize(string name)
    {
        Name = name;
        Initialized = true;

        UpdatedAt = DateTime.UtcNow;
    }
}