using Domain.Policies;

namespace Application.Members;

public static class MemberPermissionAssignmentTypes
{
    public const string Direct = "direct";

    public const string Group = "group";
}

public static class MemberPermissionDecisions
{
    public const string Allowed = "allowed";

    public const string ExplicitDeny = "explicitDeny";

    public const string NoMatchingRule = "noMatchingRule";
}

public class MemberPermissionSourceVm
{
    public string AssignmentType { get; set; }

    public Guid? GroupId { get; set; }

    public string GroupName { get; set; }
}

public class MemberPermissionPolicyAssignment
{
    public Policy Policy { get; set; }

    public MemberPermissionSourceVm Source { get; set; }
}

public class MemberPermissionVm
{
    public string StatementId { get; set; }

    public string ResourceType { get; set; }

    public string Effect { get; set; }

    public IReadOnlyCollection<string> Actions { get; set; } = [];

    public IReadOnlyCollection<string> Resources { get; set; } = [];

    public Guid PolicyId { get; set; }

    public string PolicyName { get; set; }

    public string PolicyType { get; set; }

    public IReadOnlyCollection<MemberPermissionSourceVm> Sources { get; set; } = [];

    public PolicyStatement ToStatement() => new()
    {
        Id = StatementId,
        ResourceType = ResourceType,
        Effect = Effect,
        Actions = Actions.ToArray(),
        Resources = Resources.ToArray()
    };
}

public class MemberPermissionEvaluationVm
{
    public bool Granted { get; set; }

    public string Decision { get; set; }

    public string Resource { get; set; }

    public string Action { get; set; }

    public IReadOnlyCollection<MemberPermissionVm> MatchedRules { get; set; } = [];
}

public static class MemberPermissionMapper
{
    public static IReadOnlyCollection<MemberPermissionVm> Map(IEnumerable<MemberPermissionPolicyAssignment> assignments)
    {
        var permissions = new List<MemberPermissionVm>();

        var policyGroups = assignments
            .Where(x => x.Policy != null)
            .GroupBy(x => x.Policy.Id)
            .OrderBy(x => x.First().Policy.Name)
            .ThenBy(x => x.Key);

        foreach (var policyGroup in policyGroups)
        {
            var policy = policyGroup.First().Policy;
            var sources = policyGroup
                .Select(x => x.Source)
                .Where(x => x != null)
                .GroupBy(x => new { x.AssignmentType, x.GroupId })
                .Select(x => x.First())
                .OrderBy(x => x.AssignmentType == MemberPermissionAssignmentTypes.Direct ? 0 : 1)
                .ThenBy(x => x.GroupName)
                .ToArray();

            foreach (var statement in policy.Statements ?? [])
            {
                permissions.Add(new MemberPermissionVm
                {
                    StatementId = statement.Id,
                    ResourceType = statement.ResourceType,
                    Effect = statement.Effect,
                    Actions = statement.Actions?.ToArray() ?? [],
                    Resources = statement.Resources?.ToArray() ?? [],
                    PolicyId = policy.Id,
                    PolicyName = policy.Name,
                    PolicyType = policy.Type,
                    Sources = sources
                });
            }
        }

        return permissions;
    }
}
