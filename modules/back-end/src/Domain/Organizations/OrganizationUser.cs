namespace Domain.Organizations;

public class OrganizationUser
{
    public string Id { get; set; }
    
    public string OrganizationId { get; set; }

    public string UserId { get; set; }

    public OrganizationUser(string organizationId, string userId)
    {
        Id = Guid.NewGuid().ToString();
        
        OrganizationId = organizationId;
        UserId = userId;
    }
}