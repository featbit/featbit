namespace Domain.Bases;

public class AuditedEntity : Entity
{
    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}