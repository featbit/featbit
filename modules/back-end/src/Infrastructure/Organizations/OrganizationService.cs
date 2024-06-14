using Domain.Groups;
using Domain.Members;
using Domain.Organizations;
using Domain.Policies;
using Domain.Projects;
using MongoDB.Driver;
using MongoDB.Driver.Linq;
using Environment = Domain.Environments.Environment;

namespace Infrastructure.Organizations;

public class OrganizationService : MongoDbService<Organization>, IOrganizationService
{
    private readonly IProjectService _projectService;

    public OrganizationService(MongoDbClient mongoDb, IProjectService projectService) : base(mongoDb)
    {
        _projectService = projectService;
    }

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

    public async Task<ICollection<Organization>> GetListAsync(Guid userId)
    {
        var organizations = MongoDb.QueryableOf<Organization>();
        var users = MongoDb.QueryableOf<OrganizationUser>();

        var query =
            from organization in organizations
            join user in users
                on organization.Id equals user.OrganizationId
            where user.UserId == userId
            select organization;

        return await query.ToListAsync();
    }

    public async Task AddUserAsync(
        OrganizationUser organizationUser,
        ICollection<Guid>? policies,
        ICollection<Guid>? groups)
    {
        var organizationId = organizationUser.OrganizationId;
        var userId = organizationUser.UserId;

        // if organization user already exists
        var existingUser = await MongoDb.QueryableOf<OrganizationUser>().FirstOrDefaultAsync(
            x => x.OrganizationId == organizationId && x.UserId == userId
        );
        if (existingUser != null)
        {
            return;
        }

        // add organization user
        await MongoDb.CollectionOf<OrganizationUser>().InsertOneAsync(organizationUser);

        // add member policies
        if (policies != null && policies.Any())
        {
            var memberPolicies = policies.Select(
                policyId => new MemberPolicy(organizationId, userId, policyId)
            );

            await MongoDb.CollectionOf<MemberPolicy>().InsertManyAsync(memberPolicies);
        }

        // add member to groups
        if (groups != null && groups.Any())
        {
            var groupMembers = groups.Select(
                groupId => new GroupMember(groupId, organizationId, userId)
            ).ToList();

            await MongoDb.CollectionOf<GroupMember>().InsertManyAsync(groupMembers);
        }
    }

    public async Task RemoveUserAsync(Guid organizationId, Guid userId)
    {
        // delete organization user
        await MongoDb.CollectionOf<OrganizationUser>().DeleteManyAsync(
            x => x.OrganizationId == organizationId && x.UserId == userId
        );

        // delete member policies
        await MongoDb.CollectionOf<MemberPolicy>().DeleteManyAsync(
            x => x.OrganizationId == organizationId && x.MemberId == userId
        );

        // delete member groups
        await MongoDb.CollectionOf<GroupMember>().DeleteManyAsync(
            x => x.OrganizationId == organizationId && x.MemberId == userId
        );
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
        await _projectService.DeleteManyAsync(projectIds);
    }
}