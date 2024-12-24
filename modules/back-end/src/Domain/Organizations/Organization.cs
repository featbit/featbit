namespace Domain.Organizations;

public class Organization : AuditedEntity
{
    public Guid WorkspaceId { get; set; }

    public string Name { get; set; }

    public string Key { get; set; }

    public bool Initialized { get; set; }

    public string License { get; set; }

    public OrganizationPermissions DefaultPermissions { get; set; }

    public Organization(Guid workspaceId, string name, string key)
    {
        WorkspaceId = workspaceId;
        Name = name;
        Key = key;
        Initialized = false;
        License = string.Empty;
        DefaultPermissions = new OrganizationPermissions();
    }

    public void Update(string name, OrganizationPermissions permissions)
    {
        Name = name;
        DefaultPermissions = permissions;

        UpdatedAt = DateTime.UtcNow;
    }

    public void Initialize(string name, string key)
    {
        Name = name;
        Key = key;
        Initialized = true;

        UpdatedAt = DateTime.UtcNow;
    }
}