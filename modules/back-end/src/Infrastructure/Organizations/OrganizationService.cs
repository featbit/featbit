using Application.Services;
using Domain.Groups;
using Domain.Members;
using Domain.Organizations;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.Organizations;

public class OrganizationService : MongoDbServiceBase<Organization>, IOrganizationService
{
    public OrganizationService(MongoDbClient mongoDb) : base(mongoDb)
    {
    }

    public async Task<IEnumerable<Organization>> GetListAsync(Guid userId)
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
}