using Domain.Groups;
using Domain.Policies;

namespace Application.Organizations;

public class DefaultPermissionsVm
{
    public DefaultPermissionsVm(ICollection<Policy> policies, ICollection<Group> groups)
    {
        Policies = policies.Select(policy => new DefaultPolicyVm
            {
                Id = policy.Id.ToString(),
                Name = policy.Name,
                Key = policy.Key,
                Type = policy.Type
            })
            .ToArray();

        Groups = groups.Select(group => new DefaultGroupVm
            {
                Id = group.Id.ToString(),
                Name = group.Name
            })
            .ToArray();
    }

    public DefaultPolicyVm[] Policies { get; set; } = [];

    public DefaultGroupVm[] Groups { get; set; } = [];
}

public class DefaultPolicyVm
{
    public string Id { get; set; }

    public string Name { get; set; }

    public string Key { get; set; }

    public string Type { get; set; }
}

public class DefaultGroupVm
{
    public string Id { get; set; }

    public string Name { get; set; }
}
