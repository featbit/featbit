namespace Domain.Environments;

public class Environment : AuditedEntity
{
    public Guid ProjectId { get; set; }

    public string Name { get; set; }

    public string Description { get; set; }

    public ICollection<Secret> Secrets { get; set; }

    public ICollection<Setting> Settings { get; set; }

    public Environment(Guid projectId, string name, string description = "")
    {
        Id = Guid.NewGuid();

        ProjectId = projectId;
        Name = name;
        Description = description;
        Secrets = new List<Secret>
        {
            new(Id, SecretTypes.Default)
        };
        Settings = Array.Empty<Setting>();
    }

    public void Update(string name, string description)
    {
        Name = name;
        Description = description;

        UpdatedAt = DateTime.UtcNow;
    }

    public void UpsertSettings(IEnumerable<Setting> settings)
    {
        foreach (var setting in settings)
        {
            var existing = Settings.FirstOrDefault(x => x.Id == setting.Id);
            if (existing != null)
            {
                existing.Update(setting);
            }
            else
            {
                Settings.Add(setting);
            }
        }

        UpdatedAt = DateTime.UtcNow;
    }

    public void DeleteSetting(string id)
    {
        var setting = Settings.FirstOrDefault(x => x.Id == id);
        if (setting == null)
        {
            return;
        }

        Settings.Remove(setting);
    }
}