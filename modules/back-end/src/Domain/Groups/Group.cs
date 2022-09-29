namespace Domain.Groups;

public class Group : AuditedEntity
{
    public Guid OrganizationId { get; set; }
        
    public string Name { get; set; }

    public string Description { get; set; }
}