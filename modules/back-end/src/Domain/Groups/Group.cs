namespace Domain.Groups;

public class Group
{
    public string Id { get; set; }
    
    public string OrganizationId { get; set; }
        
    public string Name { get; set; }

    public string Description { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }
}