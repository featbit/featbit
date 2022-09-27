namespace Domain.Groups;

public class GroupPolicy : AuditedEntity
{
    public string GroupId { get; set; }

    public string PolicyId { get; set; }
}