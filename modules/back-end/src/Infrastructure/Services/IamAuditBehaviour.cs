using Application.Groups;
using Application;
using Domain.AccessTokens;
using Application.Members;
using Application.Policies;
using Application.Services;
using Application.Users;
using Application.Bases.Exceptions;
using Domain.AuditLogs;
using Domain.Groups;
using Domain.Members;
using Domain.Organizations;
using Domain.Policies;
using Domain.Users;
using MediatR;
using Microsoft.AspNetCore.Http;

namespace Infrastructure.Services;

public class IamAuditBehaviour<TRequest, TResponse>(
    AuditStore store, IAuditLogService logs,
    ICurrentUser actor, IHttpContextAccessor http) : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private record Target(string Type, Guid Id, Guid? OrgId);
    private readonly IamAuditSnapshots snapshots = new(store);

    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken ct)
    {
        if (!IsMutation(request) || !store.Supported || store.Active) return await next();
        if (request is UpdateProfile) return await AuditProfile(next, ct);
        return await store.Transaction(async () =>
        {
            var targets = await Targets(request);
            var targetWorkspace = request switch { RemoveFromWorkspace x => (Guid?)x.WorkspaceId, RemoveFromOrganization x => x.WorkspaceId, _ => null };
            var before = new Dictionary<Target, object?>();
            foreach (var target in targets) before[target] = await snapshots.Read(target.Type, target.Id, target.OrgId, targetWorkspace);
            var contextOrg = Guid.TryParse(http.HttpContext?.Request.Headers["Organization"], out var org) ? org : Guid.Empty;
            var contextWorkspace = Guid.TryParse(http.HttpContext?.Request.Headers["Workspace"], out var ws) ? ws : Guid.Empty;
            if (http.HttpContext?.Items[ApplicationConsts.AccessTokenItem] is AccessToken token && token.OrganizationId != contextOrg)
                throw new ForbiddenException();
            foreach (var target in targets.Where(x => x.OrgId.HasValue))
                if (contextOrg != Guid.Empty && target.OrgId != contextOrg && request is not RemoveFromWorkspace)
                    throw new ForbiddenException();

            var requestedOrg = request switch { CreateGroup x => x.OrganizationId, CreatePolicy x => x.OrganizationId,
                ClonePolicy x => x.OrgId, AddMember x => x.OrganizationId, _ => contextOrg };
            if (contextOrg == Guid.Empty || requestedOrg != contextOrg) throw new ForbiddenException();
            var owner = (await store.Read<Organization>(x => x.Id == contextOrg)).Single();
            if (owner.WorkspaceId != contextWorkspace) throw new ForbiddenException();
            if (request is RemoveFromWorkspace remove)
            {
                if (remove.WorkspaceId != contextWorkspace) throw new ForbiddenException();
                // Current-org IAM management alone cannot authorize removing a
                // member from other organizations in this workspace.
                var membershipService = http.HttpContext!.RequestServices.GetService(typeof(IMemberService)) as IMemberService;
                foreach (var target in targets)
                {
                    if (!target.OrgId.HasValue) continue;
                    if (target.OrgId == contextOrg) continue;
                    if (membershipService == null || !PolicyHelper.IsAllowed(
                        await membershipService.GetPermissionsAsync(target.OrgId!.Value, actor.Id), "iam/*", Permissions.CanManageIAM))
                        throw new ForbiddenException();
                }
            }
            await ValidateReferences(request, contextOrg);

            PolicyCloneSource? clonedFrom = null;
            if (request is ClonePolicy clone)
            {
                Guid? sourceOrg = clone.OriginPolicyType == PolicyTypes.CustomerManaged ? clone.OrgId : null;
                var source = (await store.Read<Policy>(x =>
                    x.OrganizationId == sourceOrg && x.Key == clone.OriginPolicyKey)).SingleOrDefault();
                if (source != null) clonedFrom = new PolicyCloneSource(source.Id, source.Key);
            }

            var result = await next();
            if (result is GroupVm group && request is CreateGroup)
                targets.Add(new Target(AuditLogRefTypes.Group, Guid.Parse(group.Id), ((CreateGroup)(object)request).OrganizationId));
            if (result is PolicyVm policy && request is CreatePolicy or ClonePolicy)
                targets.Add(new Target(AuditLogRefTypes.Policy, Guid.Parse(policy.Id), request is CreatePolicy create ? create.OrganizationId : ((ClonePolicy)(object)request).OrgId));
            if (request is AddMember add)
            {
                var user = (await store.Read<User>(x => x.Email == add.Email)).Single();
                var target = new Target(AuditLogRefTypes.Member, user.Id, add.OrganizationId);
                if (!targets.Contains(target)) targets.Add(target);
            }
            foreach (var target in targets)
            {
                var previous = before.GetValueOrDefault(target);
                var current = await snapshots.Read(target.Type, target.Id, target.OrgId, targetWorkspace);
                var change = new DataChange(previous).To(current);
                if (change.Previous == change.Current) continue;
                var identity = (IamAuditSnapshot?)(current ?? previous);
                var operation = target.OrgId == null ? Operations.RemoveFromWorkspace : request.GetType().Name;
                var keyword = $"{identity?.Name} {identity?.Rn} {(identity as MemberAuditSnapshot)?.Email}";
                var log = new AuditLog(null, target.Id.ToString(), target.Type,
                    keyword[..Math.Min(keyword.Length, 512)], operation, change, "", actor.Id)
                {
                    WorkspaceId = contextWorkspace, OrganizationId = target.OrgId
                };
                change.ClonedFrom = clonedFrom;
                await logs.AddOneAsync(log);
            }
            return result;
        }, ct);
    }

    private static bool IsMutation(object r) => r is CreateGroup or UpdateGroup or DeleteGroup
        or AddGroupMember or RemoveGroupMember or AddGroupPolicy or RemoveGroupPolicy
        or CreatePolicy or ClonePolicy or UpdatePolicySetting or UpdatePolicyStatements or DeletePolicy
        or AddMember or AddMemberPolicy or RemoveMemberPolicy or RemoveFromOrganization or RemoveFromWorkspace or UpdateProfile;

    private Task<TResponse> AuditProfile(RequestHandlerDelegate<TResponse> next, CancellationToken ct) =>
        store.Transaction(async () =>
        {
            // Profile is global, so derive ownership from actual memberships, not request headers.
            var memberships = await store.Read<OrganizationUser>(x => x.UserId == actor.Id);
            var orgIds = memberships.Select(x => x.OrganizationId).Distinct().ToArray();
            var organizations = await store.Read<Organization>(x => orgIds.Contains(x.Id));
            var workspaces = await store.Read<WorkspaceUser>(x => x.UserId == actor.Id);
            var before = ProfileSnapshot((await store.Read<User>(x => x.Id == actor.Id)).Single());
            var result = await next();
            var after = ProfileSnapshot((await store.Read<User>(x => x.Id == actor.Id)).Single());
            var change = new DataChange(before).To(after);
            if (change.Previous == change.Current) return result;
            var owners = organizations.Select(x => (WorkspaceId: x.WorkspaceId, OrganizationId: (Guid?)x.Id))
                .Concat(workspaces.Where(x => !organizations.Any(o => o.WorkspaceId == x.WorkspaceId))
                    .Select(x => (WorkspaceId: x.WorkspaceId, OrganizationId: (Guid?)null))).Distinct();
            foreach (var owner in owners)
            {
                var keyword = $"{after.Name} {after.Rn} {after.Email}";
                await logs.AddOneAsync(new AuditLog(null, actor.Id.ToString(), AuditLogRefTypes.Member,
                    keyword[..Math.Min(keyword.Length, 512)], Operations.UpdateProfile, change, "", actor.Id)
                { WorkspaceId = owner.WorkspaceId, OrganizationId = owner.OrganizationId });
            }
            return result;
        }, ct);

    private static MemberAuditSnapshot ProfileSnapshot(User user) =>
        new(user.Id, user.Name, $"member/{user.Email}", user.Email, [], []);

    private async Task ValidateReferences(object request, Guid orgId)
    {
        var policyIds = request switch
        {
            AddGroupPolicy x => new[] { x.PolicyId }, AddMemberPolicy x => new[] { x.PolicyId },
            AddMember x => x.PolicyIds.ToArray(), _ => Array.Empty<Guid>()
        };
        var groupIds = request is AddMember member ? member.GroupIds.ToArray() : [];
        if (request is AddMember { PolicyIds.Count: 0, GroupIds.Count: 0 })
        {
            var org = (await store.Read<Organization>(x => x.Id == orgId)).Single();
            policyIds = org.DefaultPermissions.PolicyIds.ToArray();
            groupIds = org.DefaultPermissions.GroupIds.ToArray();
        }
        var policies = await store.Read<Policy>(x => policyIds.Contains(x.Id));
        if (policies.Count != policyIds.Distinct().Count() || policies.Any(x => x.OrganizationId != orgId && x.Type != PolicyTypes.SysManaged))
            throw new ForbiddenException();
        var groups = await store.Read<Group>(x => groupIds.Contains(x.Id) && x.OrganizationId == orgId);
        if (groups.Count != groupIds.Distinct().Count()) throw new ForbiddenException();
        var memberId = request switch { AddGroupMember x => x.MemberId, AddMemberPolicy x => x.MemberId, _ => Guid.Empty };
        if (memberId != Guid.Empty && (await store.Read<OrganizationUser>(x => x.OrganizationId == orgId && x.UserId == memberId)).Count == 0)
            throw new ForbiddenException();
    }

    private async Task<List<Target>> Targets(object r)
    {
        var groupId = r switch
        {
            UpdateGroup x => x.Id, DeleteGroup x => x.Id, AddGroupMember x => x.GroupId,
            RemoveGroupMember x => x.GroupId, AddGroupPolicy x => x.GroupId, RemoveGroupPolicy x => x.GroupId, _ => Guid.Empty
        };
        if (groupId != Guid.Empty)
        {
            var group = (await store.Read<Group>(x => x.Id == groupId)).Single();
            return [new(AuditLogRefTypes.Group, groupId, group.OrganizationId)];
        }
        var policyId = r switch { UpdatePolicySetting x => x.PolicyId, UpdatePolicyStatements x => x.PolicyId, DeletePolicy x => x.PolicyId, _ => Guid.Empty };
        if (policyId != Guid.Empty)
        {
            var policy = (await store.Read<Policy>(x => x.Id == policyId)).Single();
            if (!policy.OrganizationId.HasValue) throw new ForbiddenException();
            return [new(AuditLogRefTypes.Policy, policyId, policy.OrganizationId)];
        }
        if (r is AddMember add)
        {
            var user = (await store.Read<User>(x => x.Email == add.Email)).SingleOrDefault();
            return user == null ? [] : [new(AuditLogRefTypes.Member, user.Id, add.OrganizationId)];
        }
        if (r is AddMemberPolicy ap) return [new(AuditLogRefTypes.Member, ap.MemberId, ap.OrganizationId)];
        if (r is RemoveMemberPolicy rp) return [new(AuditLogRefTypes.Member, rp.MemberId, rp.OrganizationId)];
        if (r is RemoveFromOrganization ro) return [new(AuditLogRefTypes.Member, ro.MemberId, ro.OrganizationId), new(AuditLogRefTypes.Member, ro.MemberId, null)];
        if (r is RemoveFromWorkspace rw)
        {
            var orgs = await store.Read<Organization>(x => x.WorkspaceId == rw.WorkspaceId);
            var ids = orgs.Select(x => x.Id).ToArray();
            var memberships = await store.Read<OrganizationUser>(x => ids.Contains(x.OrganizationId) && x.UserId == rw.MemberId);
            return [.. memberships.Select(x => new Target(AuditLogRefTypes.Member, rw.MemberId, x.OrganizationId)), new(AuditLogRefTypes.Member, rw.MemberId, null)];
        }
        return [];
    }
}
