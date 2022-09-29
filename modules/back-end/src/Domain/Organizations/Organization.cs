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
}