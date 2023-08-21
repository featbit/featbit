namespace Domain.Bases;

public class FullAuditedEntity : AuditedEntity
{
    public Guid CreatorId { get; set; }

    public Guid UpdatorId { get; set; }

    public FullAuditedEntity()
    {
    }

    public FullAuditedEntity(Guid creatorId)
    {
        CreatorId = creatorId;
        UpdatorId = creatorId;
    }

    public virtual void MarkAsUpdated(Guid updatorId)
    {
        UpdatorId = updatorId;
        UpdatedAt = DateTime.UtcNow;
    }
}