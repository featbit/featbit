using Application.Services;
using Domain.Organizations;
using Infrastructure.MongoDb;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.Organizations;

public class OrganizationService : IOrganizationService
{
    private readonly IMongoCollection<Organization> _organizations;
    private readonly IMongoCollection<OrganizationUser> _organizationUsers;

    public OrganizationService(MongoDbClient client)
    {
        _organizations = client.CollectionOf<Organization>();
        _organizationUsers = client.CollectionOf<OrganizationUser>();
    }

    public async Task<Organization> GetAsync(Guid id)
    {
        return await _organizations.AsQueryable().FirstOrDefaultAsync(x => x.Id == id);
    }

    public async Task<IEnumerable<Organization>> GetListAsync(Guid userId)
    {
        var orgs = _organizations.AsQueryable();
        var users = _organizationUsers.AsQueryable();
        
        var query =
            from org in orgs
            join user in users
                on org.Id equals user.OrganizationId
            where user.UserId == userId
            select org;

        return await query.ToListAsync();
    }
}