namespace Domain.Members;

public class MemberPolicy : AuditedEntity
{
    public Guid OrganizationId { get; set; }

    public Guid MemberId { get; set; }

    public Guid PolicyId { get; set; }
}