namespace Domain.Organizations;

public class Organization : AuditedEntity
{
    public string Name { get; set; }

    public bool Initialized { get; set; }

    public string License { get; set; }
    
    public Guid WorkspaceId { get; set; }

    public Organization(Guid workspaceId, string name)
    {
        Name = name;
        Initialized = false;
        License = string.Empty;
        WorkspaceId = workspaceId;
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