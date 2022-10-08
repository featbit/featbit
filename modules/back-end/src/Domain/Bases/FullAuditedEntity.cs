namespace Domain.Bases;

public class FullAuditedEntity : AuditedEntity
{
    public Guid CreatorId { get; set; }

    public Guid? UpdatorId { get; set; }
}