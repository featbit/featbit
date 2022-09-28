namespace Domain.Groups;

public class GroupPolicy : AuditedEntity
{
    public Guid GroupId { get; set; }

    public Guid PolicyId { get; set; }
}