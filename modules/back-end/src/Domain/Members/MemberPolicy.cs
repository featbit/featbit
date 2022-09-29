namespace Domain.Members;

public class MemberPolicy : AuditedEntity
{
    public Guid OrganizationId { get; set; }

    public Guid MemberId { get; set; }

    public Guid PolicyId { get; set; }

    public MemberPolicy(Guid organizationId, Guid memberId, Guid policyId)
    {
        OrganizationId = organizationId;
        MemberId = memberId;
        PolicyId = policyId;
    }
}