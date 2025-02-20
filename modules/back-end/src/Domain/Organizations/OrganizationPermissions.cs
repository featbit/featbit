using Domain.Policies;

namespace Domain.Organizations;

public class OrganizationPermissions
{
    public ICollection<Guid> PolicyIds { get; set; } = [BuiltInPolicy.Developer];

    public ICollection<Guid> GroupIds { get; set; } = [];

    public bool IsValid()
    {
        if (PolicyIds == null || GroupIds == null)
        {
            return false;
        }

        return GroupIds.Count != 0 || PolicyIds.Count != 0;
    }
}