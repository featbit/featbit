namespace Domain.Organizations;

public class OrganizationUser : AuditedEntity
{
    public Guid OrganizationId { get; set; }

    public Guid UserId { get; set; }

    public Guid? InvitorId { get; set; }

    public string InitialPassword { get; set; }

    public OrganizationUser(
        Guid organizationId,
        Guid userId,
        Guid? invitorId = null,
        string initialPassword = "")
    {
        OrganizationId = organizationId;
        UserId = userId;
        InvitorId = invitorId;
        InitialPassword = initialPassword;
    }
}