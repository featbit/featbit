using Domain.Groups;
using Domain.Members;
using Domain.Organizations;
using Domain.Projects;
using Microsoft.EntityFrameworkCore;
using Environment = Domain.Environments.Environment;

namespace Infrastructure.Services.EntityFrameworkCore;

public class OrganizationService(AppDbContext dbContext)
    : EntityFrameworkCoreService<Organization>(dbContext), IOrganizationService
{
    public async Task<string[]> GetScopesAsync(ScopeString[] scopeStrings)
    {
        var projectIds = scopeStrings.Select(x => x.ProjectId);
        var envIds = scopeStrings.SelectMany(x => x.EnvIds);

        var projects =
            await QueryableOf<Project>().Where(x => projectIds.Contains(x.Id)).ToListAsync();
        var environments =
            await QueryableOf<Environment>().Where(x => envIds.Contains(x.Id)).ToListAsync();

        var aggregation =
            from scopeString in scopeStrings
            let project = projects.FirstOrDefault(x => x.Id == scopeString.ProjectId)
            let envs = environments.Where(x => scopeString.EnvIds.Contains(x.Id))
            select $"{project?.Name}/{string.Join(',', envs.Select(x => x.Name))}";

        return aggregation.ToArray();
    }

    public async Task<ICollection<Organization>> GetUserOrganizationsAsync(Guid workspaceId, Guid userId)
    {
        var organizations = QueryableOf<Organization>();
        var users = QueryableOf<OrganizationUser>();

        var query =
            from organization in organizations
            join user in users
                on organization.Id equals user.OrganizationId
            where user.UserId == userId && organization.WorkspaceId == workspaceId
            select organization;

        return await query.ToListAsync();
    }

    public async Task<bool> HasKeyBeenUsedAsync(Guid workspaceId, string key)
    {
        return await AnyAsync(organization =>
            organization.WorkspaceId == workspaceId &&
            string.Equals(organization.Key.ToLower(), key.ToLower())
        );
    }

    public async Task<bool> ContainsUserAsync(Guid organizationId, Guid userId)
    {
        var exists = await QueryableOf<OrganizationUser>().AnyAsync(
            x => x.OrganizationId == organizationId && x.UserId == userId
        );

        return exists;
    }

    public async Task AddUserAsync(
        OrganizationUser organizationUser,
        ICollection<Guid>? policies,
        ICollection<Guid>? groups)
    {
        var organizationId = organizationUser.OrganizationId;
        var userId = organizationUser.UserId;

        // if user is already in organization, do nothing
        var exists = await ContainsUserAsync(organizationId, userId);
        if (exists)
        {
            return;
        }

        // add organization user
        SetOf<OrganizationUser>().Add(organizationUser);

        // add member policies
        if (policies != null && policies.Count != 0)
        {
            var memberPolicies = policies.Select(
                policyId => new MemberPolicy(organizationId, userId, policyId)
            );

            SetOf<MemberPolicy>().AddRange(memberPolicies);
        }

        // add member to groups
        if (groups != null && groups.Count != 0)
        {
            var groupMembers = groups.Select(
                groupId => new GroupMember(groupId, organizationId, userId)
            ).ToList();

            SetOf<GroupMember>().AddRange(groupMembers);
        }

        await SaveChangesAsync();
    }
}
