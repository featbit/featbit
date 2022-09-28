namespace Domain.Bases;

public class AuditedEntity : Entity
{
    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public AuditedEntity()
    {
        CreatedAt = DateTime.UtcNow;
        UpdatedAt = CreatedAt;
    }
}