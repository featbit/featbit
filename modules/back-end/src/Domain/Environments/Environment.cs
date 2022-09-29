using System.Text;

namespace Domain.Environments;

public class Environment : AuditedEntity
{
    public Guid ProjectId { get; set; }

    public string Name { get; set; }

    public string Description { get; set; }

    public string Secret { get; set; }

    public Environment(Guid projectId, string name, string description = "")
    {
        Id = Guid.NewGuid();
        
        ProjectId = projectId;
        Name = name;
        Description = description;
        Secret = NewSecret();

        string NewSecret(string device = "default")
        {
            var time = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

            var originText =
                $"{time}/{Id}/{device}";

            var textBytes = Encoding.UTF8.GetBytes(originText);
            return Convert.ToBase64String(textBytes);
        }
    }

    public void Update(string name, string description)
    {
        Name = name;
        Description = description;
        
        UpdatedAt = DateTime.UtcNow;
    }
}