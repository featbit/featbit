namespace Domain.Workspaces;

public class Workspace : AuditedEntity
{
    public string Name { get; set; }

    public string Key { get; set; }
    
    public string License { get; set; }

    public Workspace(string name, string key)
    {
        Name = name;
        License = string.Empty;
    }

    public void UpdateName(string name)
    {
        Name = name;

        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateLicense(string license)
    {
        License = license;

        UpdatedAt = DateTime.UtcNow;
    }
}