using Domain.Organizations;

namespace Application.Organizations;

public class OrganizationVm
{
    public string Id { get; set; }

    public string Name { get; set; }

    public string Key { get; set; }

    public bool Initialized { get; set; }

    public string License { get; set; }

    public OrganizationPermissions DefaultPermissions { get; set; }
}