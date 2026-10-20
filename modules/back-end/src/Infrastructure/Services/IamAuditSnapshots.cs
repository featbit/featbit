using Domain.Groups;
using Domain.Members;
using Domain.Organizations;
using Domain.Policies;
using Domain.Users;

namespace Infrastructure.Services;

public record IamAuditReference(Guid Id, string Name, string Rn);
public abstract record IamAuditSnapshot(Guid Id, string Name, string Rn);
public record MemberAuditSnapshot(Guid Id, string Name, string Rn, string? Email,
    IamAuditReference[] Groups, IamAuditReference[] Policies) : IamAuditSnapshot(Id, Name, Rn);
public record GroupAuditSnapshot(Guid Id, string Name, string Rn, string? Description,
    IamAuditReference[] Members, IamAuditReference[] Policies) : IamAuditSnapshot(Id, Name, Rn);
public record PolicyAuditSnapshot(Guid Id, string Name, string Rn, string? Description,
    PolicyStatement[] Statements, IamAuditReference[] Members, IamAuditReference[] Groups) : IamAuditSnapshot(Id, Name, Rn);

// Whitelisted snapshots: never serialize a User (which contains credentials).
public class IamAuditSnapshots(AuditStore store)
{
    public async Task<IamAuditSnapshot?> Read(string type, Guid id, Guid? orgId, Guid? workspaceId = null)
    {
        var members = new List<IamAuditReference>();
        var groups = new List<IamAuditReference>();
        var policies = new List<IamAuditReference>();
        string name, rn;
        string? email = null, description = null;
        PolicyStatement[] statements = [];
        Guid[] memberIds = [], groupIds = [], policyIds = [];
        if (type == "Group")
        {
            var group = (await store.Read<Group>(x => x.Id == id)).SingleOrDefault();
            if (group == null) return null;
            name = group.Name; rn = $"group/{group.Name}"; description = group.Description;
            memberIds = (await store.Read<GroupMember>(x => x.GroupId == id)).Select(x => x.MemberId).ToArray();
            policyIds = (await store.Read<GroupPolicy>(x => x.GroupId == id)).Select(x => x.PolicyId).ToArray();
        }
        else if (type == "Policy")
        {
            var policy = (await store.Read<Policy>(x => x.Id == id)).SingleOrDefault();
            if (policy == null) return null;
            name = policy.Name; rn = $"policy/{policy.Key}"; description = policy.Description;
            statements = policy.Statements.OrderBy(x => x.Id).Select(x => new PolicyStatement
            { Id = x.Id, ResourceType = x.ResourceType, Effect = x.Effect,
                Actions = x.Actions.Distinct().Order().ToArray(), Resources = x.Resources.Distinct().Order().ToArray() }).ToArray();
            memberIds = (await store.Read<MemberPolicy>(x => x.PolicyId == id)).Select(x => x.MemberId).ToArray();
            groupIds = (await store.Read<GroupPolicy>(x => x.PolicyId == id)).Select(x => x.GroupId).ToArray();
        }
        else
        {
            if (orgId.HasValue)
            {
                if ((await store.Read<OrganizationUser>(x => x.OrganizationId == orgId && x.UserId == id)).Count == 0) return null;
            }
            else if ((await store.Read<WorkspaceUser>(x => x.WorkspaceId == workspaceId && x.UserId == id)).Count == 0) return null;
            var user = (await store.Read<User>(x => x.Id == id)).SingleOrDefault();
            if (user == null) return null;
            name = user.Name; email = user.Email; rn = $"member/{email}";
            groupIds = (await store.Read<GroupMember>(x => x.OrganizationId == orgId && x.MemberId == id)).Select(x => x.GroupId).ToArray();
            policyIds = (await store.Read<MemberPolicy>(x => x.OrganizationId == orgId && x.MemberId == id)).Select(x => x.PolicyId).ToArray();
        }
        if (memberIds.Length > 0) members = (await store.Read<User>(x => memberIds.Contains(x.Id))).Select(x => new IamAuditReference(x.Id, x.Name, $"member/{x.Email}")).ToList();
        if (groupIds.Length > 0) groups = (await store.Read<Group>(x => groupIds.Contains(x.Id))).Select(x => new IamAuditReference(x.Id, x.Name, $"group/{x.Name}")).ToList();
        if (policyIds.Length > 0) policies = (await store.Read<Policy>(x => policyIds.Contains(x.Id))).Select(x => new IamAuditReference(x.Id, x.Name, $"policy/{x.Key}")).ToList();
        var sortedMembers = members.OrderBy(x => x.Id).ToArray();
        var sortedGroups = groups.OrderBy(x => x.Id).ToArray();
        var sortedPolicies = policies.OrderBy(x => x.Id).ToArray();
        return type switch
        {
            "Group" => new GroupAuditSnapshot(id, name, rn, description, sortedMembers, sortedPolicies),
            "Policy" => new PolicyAuditSnapshot(id, name, rn, description, statements, sortedMembers, sortedGroups),
            _ => new MemberAuditSnapshot(id, name, rn, email, sortedGroups, sortedPolicies)
        };
    }
}
