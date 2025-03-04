using Domain.Groups;
using Domain.Members;
using Domain.Organizations;
using Domain.Policies;
using Domain.Projects;
using Microsoft.EntityFrameworkCore;
using Environment = Domain.Environments.Environment;

namespace Infrastructure.Services.EntityFrameworkCore;

public class OrganizationService(AppDbContext dbContext, IProjectService projectService)
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

    public async Task<ICollection<Organization>> GetListAsync(Guid userId)
    {
        var organizations = QueryableOf<Organization>();
        var users = QueryableOf<OrganizationUser>();

        var query =
            from organization in organizations
            join user in users
                on organization.Id equals user.OrganizationId
            where user.UserId == userId
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

    public async Task AddUserAsync(
        OrganizationUser organizationUser,
        ICollection<Guid>? policies,
        ICollection<Guid>? groups)
    {
        var organizationId = organizationUser.OrganizationId;
        var userId = organizationUser.UserId;

        // if organization user already exists
        var existingUser = await QueryableOf<OrganizationUser>().FirstOrDefaultAsync(
            x => x.OrganizationId == organizationId && x.UserId == userId
        );
        if (existingUser != null)
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

    public async Task RemoveUserAsync(Guid organizationId, Guid userId)
    {
        // delete organization user
        await SetOf<OrganizationUser>()
            .Where(x => x.OrganizationId == organizationId && x.UserId == userId)
            .ExecuteDeleteAsync();

        // delete member policies
        await SetOf<MemberPolicy>()
            .Where(x => x.OrganizationId == organizationId && x.MemberId == userId)
            .ExecuteDeleteAsync();

        // delete member groups
        await SetOf<GroupMember>()
            .Where(x => x.OrganizationId == organizationId && x.MemberId == userId)
            .ExecuteDeleteAsync();
    }

    public async Task DeleteAsync(Guid id)
    {
        // delete organization
        await DeleteOneAsync(id);

        // delete organization user
        await SetOf<OrganizationUser>().Where(x => x.OrganizationId == id).ExecuteDeleteAsync();

        // delete organization policies & groups
        await SetOf<Policy>().Where(x => x.OrganizationId == id).ExecuteDeleteAsync();
        await SetOf<MemberPolicy>().Where(x => x.OrganizationId == id).ExecuteDeleteAsync();
        await SetOf<Group>().Where(x => x.OrganizationId == id).ExecuteDeleteAsync();
        await SetOf<GroupMember>().Where(x => x.OrganizationId == id).ExecuteDeleteAsync();

        // delete projects
        var projectIds = await QueryableOf<Project>()
            .Where(x => x.OrganizationId == id)
            .Select(x => x.Id)
            .ToListAsync();
        await projectService.DeleteManyAsync(projectIds);
    }
}