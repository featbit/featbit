using Domain.Groups;
using Domain.Members;
using Domain.Organizations;
using Domain.Policies;
using Domain.Projects;
using MongoDB.Driver;
using MongoDB.Driver.Linq;
using Environment = Domain.Environments.Environment;

namespace Infrastructure.Services.MongoDb;

public class OrganizationService(MongoDbClient mongoDb, IProjectService projectService)
    : MongoDbService<Organization>(mongoDb), IOrganizationService
{
    public async Task<string[]> GetScopesAsync(ScopeString[] scopeStrings)
    {
        var projectIds = scopeStrings.Select(x => x.ProjectId);
        var envIds = scopeStrings.SelectMany(x => x.EnvIds);

        var projects =
            await MongoDb.QueryableOf<Project>().Where(x => projectIds.Contains(x.Id)).ToListAsync();
        var environments =
            await MongoDb.QueryableOf<Environment>().Where(x => envIds.Contains(x.Id)).ToListAsync();

        var aggregation =
            from scopeString in scopeStrings
            let project = projects.FirstOrDefault(x => x.Id == scopeString.ProjectId)
            let envs = environments.Where(x => scopeString.EnvIds.Contains(x.Id))
            select $"{project?.Name}/{string.Join(',', envs.Select(x => x.Name))}";

        return aggregation.ToArray();
    }

    public async Task<ICollection<Organization>> GetUserOrganizationsAsync(Guid workspaceId, Guid userId)
    {
        var organizations = MongoDb.QueryableOf<Organization>();
        var users = MongoDb.QueryableOf<OrganizationUser>();

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
            string.Equals(organization.Key, key, StringComparison.OrdinalIgnoreCase)
        );
    }

    public async Task<bool> ContainsUserAsync(Guid organizationId, Guid userId)
    {
        var exists = await MongoDb.QueryableOf<OrganizationUser>().AnyAsync(
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
        await MongoDb.CollectionOf<OrganizationUser>().InsertOneAsync(organizationUser);

        // add member policies
        if (policies != null && policies.Count != 0)
        {
            var memberPolicies = policies.Select(
                policyId => new MemberPolicy(organizationId, userId, policyId)
            );

            await MongoDb.CollectionOf<MemberPolicy>().InsertManyAsync(memberPolicies);
        }

        // add member to groups
        if (groups != null && groups.Count != 0)
        {
            var groupMembers = groups.Select(
                groupId => new GroupMember(groupId, organizationId, userId)
            ).ToList();

            await MongoDb.CollectionOf<GroupMember>().InsertManyAsync(groupMembers);
        }
    }

    public async Task DeleteAsync(Guid id)
    {
        // delete organization
        await MongoDb.CollectionOf<Organization>().DeleteOneAsync(x => x.Id == id);

        // delete organization user
        await MongoDb.CollectionOf<OrganizationUser>().DeleteManyAsync(x => x.OrganizationId == id);

        // delete organization policies & groups
        await MongoDb.CollectionOf<Policy>().DeleteManyAsync(x => x.OrganizationId == id);
        await MongoDb.CollectionOf<MemberPolicy>().DeleteManyAsync(x => x.OrganizationId == id);
        await MongoDb.CollectionOf<Group>().DeleteManyAsync(x => x.OrganizationId == id);
        await MongoDb.CollectionOf<GroupMember>().DeleteManyAsync(x => x.OrganizationId == id);

        // delete projects
        var projectIds = await MongoDb.QueryableOf<Project>()
            .Where(x => x.OrganizationId == id)
            .Select(x => x.Id)
            .ToListAsync();
        await projectService.DeleteManyAsync(projectIds);
    }
}