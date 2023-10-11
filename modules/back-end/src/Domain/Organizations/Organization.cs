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
        License = string.Empty;
    }

    public void UpdateName(string name)
    {
        Name = name;

        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateLicense(string license)
    {
        if (!LicenseVerifier.TryParse(Id, license, out _))
        {
            throw new ArgumentException($"The license '{license}' is invalid.", nameof(license));
        }
        
        License = license;

        UpdatedAt = DateTime.UtcNow;
    }

    public void Update(string name, bool initialized)
    {
        Name = name;
        Initialized = initialized;

        UpdatedAt = DateTime.UtcNow;
    }
}