using Domain.Policies;

namespace Domain.Organizations;

public class OrganizationPermissions
{
    public ICollection<Guid> PolicyIds { get; set; } = [BuiltInPolicy.Developer];

    public ICollection<Guid> GroupIds { get; set; } = Array.Empty<Guid>();
}