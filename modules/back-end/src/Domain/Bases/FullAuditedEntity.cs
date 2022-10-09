namespace Domain.Bases;

public class FullAuditedEntity : AuditedEntity
{
    public Guid CreatorId { get; set; }

    public Guid UpdatorId { get; set; }

    public FullAuditedEntity(Guid creatorId)
    {
        CreatorId = creatorId;
        UpdatorId = creatorId;
    }
}