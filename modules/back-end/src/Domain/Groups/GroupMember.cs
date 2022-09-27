namespace Domain.Groups;

public class GroupMember : AuditedEntity
{
    public string GroupId { get; set; }

    public string OrganizationId { get; set; }

    public string MemberId { get; set; }
}