using Application.Bases.Models;
using Application.Groups;
using Domain.Groups;
using Domain.Organizations;
using Domain.Policies;
using Domain.Users;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.Groups;

public class GroupService : MongoDbService<Group>, IGroupService
{
    public GroupService(MongoDbClient mongoDb) : base(mongoDb)
    {
    }

    public async Task DeleteAsync(Guid id)
    {
        // delete group
        await MongoDb.CollectionOf<Group>().DeleteOneAsync(x => x.Id == id);

        // delete group member
        await MongoDb.CollectionOf<GroupMember>().DeleteManyAsync(x => x.GroupId == id);

        // delete group policy
        await MongoDb.CollectionOf<GroupPolicy>().DeleteManyAsync(x => x.GroupId == id);
    }

    public async Task<PagedResult<Group>> GetListAsync(Guid organizationId, GroupFilter groupFilter)
    {
        var filterBuilder = Builders<Group>.Filter;

        var filters = new List<FilterDefinition<Group>>
        {
            // organizationId filter
            filterBuilder.Eq(group => group.OrganizationId, organizationId)
        };

        // name filter
        var name = groupFilter.Name;
        if (!string.IsNullOrWhiteSpace(name))
        {
            var nameFilter = filterBuilder.Where(x => x.Name.Contains(name, StringComparison.CurrentCultureIgnoreCase));
            filters.Add(nameFilter);
        }

        var collection = MongoDb.CollectionOf<Group>();
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

    public async Task<PagedResult<GroupMemberVm>> GetMembersAsync(
        Guid organizationId,
        Guid groupId,
        GroupMemberFilter filter)
    {
        var members = MongoDb.QueryableOf<User>();
        var organizationUsers = MongoDb.QueryableOf<OrganizationUser>();
        var groupMembers = MongoDb.QueryableOf<GroupMember>();

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
                Name = member.Name,
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
            Name = x.Name,
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
        var policies = MongoDb.QueryableOf<Policy>();
        var groupPolicies = MongoDb.QueryableOf<GroupPolicy>();

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

    public async Task AddMemberAsync(Guid organizationId, Guid groupId, Guid memberId)
    {
        var existed = await MongoDb.QueryableOf<GroupMember>()
            .CountAsync(x => x.OrganizationId == organizationId && x.GroupId == groupId && x.MemberId == memberId) > 0;
        if (existed)
        {
            return;
        }

        var groupMember = new GroupMember(groupId, organizationId, memberId);

        await MongoDb.CollectionOf<GroupMember>().InsertOneAsync(groupMember);
    }

    public async Task RemoveMemberAsync(Guid groupId, Guid memberId)
    {
        await MongoDb.CollectionOf<GroupMember>()
            .DeleteOneAsync(x => x.GroupId == groupId && x.MemberId == memberId);
    }

    public async Task AddPolicyAsync(Guid groupId, Guid policyId)
    {
        var existed = await MongoDb.QueryableOf<GroupPolicy>()
            .CountAsync(x => x.GroupId == groupId && x.PolicyId == policyId) > 0;
        if (existed)
        {
            return;
        }

        var groupPolicy = new GroupPolicy(groupId, policyId);

        await MongoDb.CollectionOf<GroupPolicy>().InsertOneAsync(groupPolicy);
    }

    public async Task RemovePolicyAsync(Guid groupId, Guid policyId)
    {
        await MongoDb.CollectionOf<GroupPolicy>()
            .DeleteOneAsync(x => x.GroupId == groupId && x.PolicyId == policyId);
    }
}