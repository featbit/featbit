namespace Domain.Organizations;

public class Organization : AuditedEntity
{
    public string Name { get; set; }

    public bool Initialized { get; set; }
    
    public string License { get; set; }

    public Organization(string name)
    {
        Name = name;
        Initialized = false;
    }

    public void UpdateLicense(string license)
    {
        License = license;

        UpdatedAt = DateTime.UtcNow;
    }
    
    public void UpdateName(string name)
    {
        Name = name;

        UpdatedAt = DateTime.UtcNow;
    }

    public void Update(string name, bool initialized)
    {
        Name = name;
        Initialized = initialized;

        UpdatedAt = DateTime.UtcNow;
    }
}