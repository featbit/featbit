namespace Domain.Organizations;

public class OrganizationUser
{
    public string Id { get; set; }
    
    public string OrganizationId { get; set; }

    public string UserId { get; set; }

    public string InvitorId { get; set; }

    public string InitialPassword { get; set; }
}