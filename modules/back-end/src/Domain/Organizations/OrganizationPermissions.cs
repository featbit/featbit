namespace Domain.Organizations;

public class OrganizationPermissions
{
    public ICollection<Guid> PolicyIds { get; set; }
    public ICollection<Guid> GroupIds { get; set;  }

    public OrganizationPermissions()
    {
        PolicyIds = new List<Guid>();
        GroupIds = new List<Guid>();
    }
}