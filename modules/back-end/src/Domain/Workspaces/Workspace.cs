namespace Domain.Workspaces;

public class Workspace : AuditedEntity
{
    public string Name { get; set; }

    public string Key { get; set; }
    
    public string License { get; set; }

    public SsoConfig Sso { get; set; }

    public Workspace(string name, string key)
    {
        Name = name;
        License = string.Empty;
    }

    public void Update(string name, string key)
    {
        Name = name;
        Key = key;

        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateLicense(string license)
    {
        License = license;

        UpdatedAt = DateTime.UtcNow;
    }
}