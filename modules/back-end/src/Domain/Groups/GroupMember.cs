namespace Domain.Groups;

public class GroupMember : AuditedEntity
{
    public Guid GroupId { get; set; }

    public Guid OrganizationId { get; set; }

    public Guid MemberId { get; set; }
}