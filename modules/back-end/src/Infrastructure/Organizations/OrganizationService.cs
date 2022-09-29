using Application.Services;
using Domain.Groups;
using Domain.Members;
using Domain.Organizations;
using Infrastructure.MongoDb;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.Organizations;

public class OrganizationService : IOrganizationService
{
    private readonly MongoDbClient _mongoDb;

    public OrganizationService(MongoDbClient mongoDb)
    {
        _mongoDb = mongoDb;
    }

    public async Task<Organization> GetAsync(Guid id)
    {
        return await _mongoDb.QueryableOf<Organization>().FirstOrDefaultAsync(x => x.Id == id);
    }

    public async Task<IEnumerable<Organization>> GetListAsync(Guid userId)
    {
        var organizations = _mongoDb.QueryableOf<Organization>();
        var users = _mongoDb.QueryableOf<OrganizationUser>();

        var query =
            from organization in organizations
            join user in users
                on organization.Id equals user.OrganizationId
            where user.UserId == userId
            select organization;

        return await query.ToListAsync();
    }

    public async Task AddAsync(Organization organization)
    {
        await _mongoDb.CollectionOf<Organization>().InsertOneAsync(organization);
    }

    public async Task UpdateAsync(Organization organization)
    {
        var org = await this.GetAsync(organization.Id);
        
        if (org == null)
        {
            return;
        }

        await _mongoDb.CollectionOf<Organization>().ReplaceOneAsync(o => o.Id == org.Id, org);
    }

    public async Task AddUserAsync(
        OrganizationUser organizationUser,
        ICollection<Guid>? policies,
        ICollection<Guid>? groups)
    {
        var organizationId = organizationUser.OrganizationId;
        var userId = organizationUser.UserId;
        
        // if organization user already exists
        var existingUser = await _mongoDb.QueryableOf<OrganizationUser>().FirstOrDefaultAsync(
            x => x.OrganizationId == organizationId && x.UserId == userId
        );
        if (existingUser != null)
        {
            return;
        }

        // add organization user
        await _mongoDb.CollectionOf<OrganizationUser>().InsertOneAsync(organizationUser);

        // add member policies
        if (policies != null && policies.Any())
        {
            var memberPolicies = policies.Select(
                policyId => new MemberPolicy(organizationId, userId, policyId)
            );

            await _mongoDb.CollectionOf<MemberPolicy>().InsertManyAsync(memberPolicies);
        }

        // add member to groups
        if (groups != null && groups.Any())
        {
            var groupMembers = groups.Select(
                groupId => new GroupMember(groupId, organizationId, userId)
            ).ToList();

            await _mongoDb.CollectionOf<GroupMember>().InsertManyAsync(groupMembers);
        }
    }
}