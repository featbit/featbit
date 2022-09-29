using System.Data;

namespace Domain.Organizations;

public class Organization : AuditedEntity
{
    public string Name { get; set; }

    public bool Initialized { get; set; }

    public Organization(string name)
    {
        Name = name;
        Initialized = false;
    }

    public void Update(string name, bool initialized)
    {
        Name = name;
        Initialized = initialized;
        UpdatedAt = DateTime.UtcNow;
    }
}