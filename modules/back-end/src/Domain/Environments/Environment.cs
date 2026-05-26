namespace Domain.Environments;

public class Environment : AuditedEntity
{
    public Guid ProjectId { get; set; }

    public string Name { get; set; }

    public string Key { get; set; }

    public string Description { get; set; }

    public ICollection<Secret> Secrets { get; set; }

    public EnvironmentSettings Settings { get; set; }

    public Environment(Guid projectId, string name, string key, string description = "", EnvironmentSettings settings = null)
    {
        Id = Guid.NewGuid();

        ProjectId = projectId;
        Name = name;
        Key = key;
        Description = description;
        Secrets = new List<Secret>
        {
            new(Id, "Server Key", SecretTypes.Server),
            new(Id, "Client Key", SecretTypes.Client)
        };

        Settings = settings ?? new EnvironmentSettings();
    }

    public void Update(string name, string description, EnvironmentSettings settings = null)
    {
        Name = name;
        Description = description;
        if (settings != null)
        {
            Settings = settings;
        }

        UpdatedAt = DateTime.UtcNow;
    }

    public Secret RemoveSecret(string secretId)
    {
        var secret = Secrets.FirstOrDefault(x => x.Id == secretId);
        if (secret == null)
        {
            return null;
        }

        Secrets.Remove(secret);
        return secret;
    }

    public void AddSecret(Secret secret)
    {
        Secrets.Add(secret);
    }

    public void UpdateSecret(string secretId, string name)
    {
        var secret = Secrets.FirstOrDefault(x => x.Id == secretId);
        if (secret == null)
        {
            return;
        }

        secret.Name = name;
    }
}