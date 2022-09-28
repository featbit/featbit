using Application.Bases.Exceptions;
using Application.Bases.Models;
using Application.Groups;
using Application.Services;
using Domain.Groups;
using Domain.Organizations;
using Domain.Policies;
using Domain.Users;
using Infrastructure.MongoDb;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.Groups;

public class GroupService : IGroupService
{
    private readonly MongoDbClient _mongoDb;

    public GroupService(MongoDbClient mongoDb)
    {
        _mongoDb = mongoDb;
    }

    public async Task<Group> GetAsync(Guid id)
    {
        var group = await _mongoDb.QueryableOf<Group>().FirstOrDefaultAsync(x => x.Id == id);
        if (group == null)
        {
            throw new EntityNotFoundException(nameof(Group), id.ToString());
        }

        return group;
    }

    public async Task<PagedResult<Group>> GetListAsync(Guid organizationId, GroupFilter groupFilter)
    {
        var filterBuilder = Builders<Group>.Filter;

        var filters = new List<FilterDefinition<Group>>
        {
            // accountId filter
            filterBuilder.Eq(group => group.OrganizationId, organizationId)
        };

        // name filter
        var name = groupFilter.Name;
        if (!string.IsNullOrWhiteSpace(name))
        {
            var nameFilter = filterBuilder.Where(x => x.Name.Contains(name, StringComparison.CurrentCultureIgnoreCase));
            filters.Add(nameFilter);
        }

        var collection = _mongoDb.CollectionOf<Group>();
        var filter = filterBuilder.And(filters);

        var totalCount = await collection.CountDocumentsAsync(filter);
        var itemsQuery = collection
            .Find(filter)
            .Sort("{_id: -1}")
            .Skip(groupFilter.PageIndex * groupFilter.PageSize)
            .Limit(groupFilter.PageSize);

        var items = await itemsQuery.ToListAsync();

        return new PagedResult<Group>(totalCount, items);
    }

    public async Task<bool> IsNameUsedAsync(Guid organizationId, string name)
    {
        var isNameUsed =
            await _mongoDb.QueryableOf<Group>().AnyAsync(x => x.OrganizationId == organizationId && x.Name == name);

        return isNameUsed;
    }

    public async Task<PagedResult<GroupMemberVm>> GetMembersAsync(
        Guid organizationId,
        Guid groupId,
        GroupMemberFilter filter)
    {
        var members = _mongoDb.QueryableOf<User>();
        var organizationUsers = _mongoDb.QueryableOf<OrganizationUser>();
        var groupMembers = _mongoDb.QueryableOf<GroupMember>();

        var query =
            from member in members
            join organizationUser in organizationUsers
                on member.Id equals organizationUser.UserId
            join groupMember in groupMembers
                on member.Id equals groupMember.MemberId
                into allGroups
            where organizationUser.OrganizationId == organizationId
            select new
            {
                Id = member.Id,
                member.Email,
                Groups = allGroups,
            };

        if (!filter.GetAllMembers)
        {
            query = query.Where(x => x.Groups.Any(y => y.GroupId == groupId));
        }

        // email filter
        var searchText = filter.SearchText;
        if (!string.IsNullOrWhiteSpace(searchText))
        {
            query = query.Where(x => x.Email.Contains(searchText, StringComparison.CurrentCultureIgnoreCase));
        }

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip(filter.PageIndex * filter.PageSize)
            .Take(filter.PageSize)
            .ToListAsync();

        var vms = items.Select(x => new GroupMemberVm
        {
            Id = x.Id,
            Email = x.Email,
            IsGroupMember = x.Groups.Any(y => y.GroupId == groupId),
        }).ToList();

        return new PagedResult<GroupMemberVm>(totalCount, vms);
    }

    public async Task<PagedResult<GroupPolicyVm>> GetPoliciesAsync(
        Guid organizationId, 
        Guid groupId,
        GroupPolicyFilter filter)
    {
        var policies = _mongoDb.QueryableOf<Policy>();
        var groupPolicies = _mongoDb.QueryableOf<GroupPolicy>();

        var query =
            from policy in policies
            join groupPolicy in groupPolicies
                on policy.Id equals groupPolicy.PolicyId
                into allPolicyGroups
            where policy.OrganizationId == organizationId || policy.Type == PolicyTypes.SysManaged
            select new
            {
                policy.Id,
                policy.Name,
                policy.Type,
                policy.Description,
                AllPolicyGroups = allPolicyGroups
            };

        if (!filter.GetAllPolicies)
        {
            query = query.Where(x => x.AllPolicyGroups.Any(y => y.GroupId == groupId));
        }

        // name filter
        var name = filter.Name;
        if (!string.IsNullOrWhiteSpace(name))
        {
            query = query.Where(x => x.Name.Contains(name, StringComparison.CurrentCultureIgnoreCase));
        }

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip(filter.PageIndex * filter.PageSize)
            .Take(filter.PageSize)
            .ToListAsync();

        var vms = items.Select(x => new GroupPolicyVm
        {
            Id = x.Id.ToString(),
            Name = x.Name,
            Type = x.Type,
            Description = x.Description,
            IsGroupPolicy = x.AllPolicyGroups.Any(y => y.GroupId == groupId)
        }).ToList();

        return new PagedResult<GroupPolicyVm>(totalCount, vms);
    }
}