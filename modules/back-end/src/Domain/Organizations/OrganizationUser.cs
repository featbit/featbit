namespace Domain.Organizations;

public class OrganizationUser : AuditedEntity
{
    public Guid OrganizationId { get; set; }

    public Guid UserId { get; set; }

    public Guid? InvitorId { get; set; }

    public string InitialPassword { get; set; }
}