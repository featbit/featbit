namespace Domain.Members;

public class MemberPolicy : AuditedEntity
{
    public string OrganizationId { get; set; }

    public string MemberId { get; set; }

    public string PolicyId { get; set; }
}