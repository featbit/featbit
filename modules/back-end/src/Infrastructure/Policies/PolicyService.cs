using Application.Bases.Models;
using Application.Policies;
using Domain.Groups;
using Domain.Members;
using Domain.Organizations;
using Domain.Policies;
using Domain.Users;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.Policies;

public class PolicyService : MongoDbService<Policy>, IPolicyService
{
    public PolicyService(MongoDbClient mongoDb) : base(mongoDb)
    {
    }

    public async Task DeleteAsync(Guid id)
    {
        // delete policy 
        await MongoDb.CollectionOf<Policy>().DeleteOneAsync(x => x.Id == id);

        // delete policy groups
        await MongoDb.CollectionOf<GroupPolicy>()
            .DeleteManyAsync(x => x.PolicyId == id);

        // delete policy members
        await MongoDb.CollectionOf<MemberPolicy>()
            .DeleteManyAsync(x => x.PolicyId == id);
    }

    public async Task<PagedResult<Policy>> GetListAsync(Guid organizationId, PolicyFilter filter)
    {
        var query = MongoDb.QueryableOf<Policy>()
            .Where(x => x.OrganizationId == organizationId || x.Type == PolicyTypes.SysManaged);

        var name = filter.Name;
        if (!string.IsNullOrWhiteSpace(name))
        {
            query = query.Where(x => x.Name.Contains(name, StringComparison.CurrentCultureIgnoreCase));
        }

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderByDescending(x => x.CreatedAt)
            .Skip(filter.PageIndex * filter.PageSize)
            .Take(filter.PageSize)
            .ToListAsync();

        return new PagedResult<Policy>(totalCount, items);
    }

    public async Task<PagedResult<PolicyGroup>> GetGroupsAsync(
        Guid organizationId,
        Guid policyId,
        PolicyGroupFilter filter)
    {
        var groups = MongoDb.QueryableOf<Group>();
        var groupPolicies = MongoDb.QueryableOf<GroupPolicy>();

        var query =
            from theGroup in groups
            join groupPolicy in groupPolicies
                on theGroup.Id equals groupPolicy.GroupId
                into allGroupPolicies
            where theGroup.OrganizationId == organizationId
            select new
            {
                theGroup.Id,
                theGroup.Name,
                theGroup.Description,
                AllGroupPolicies = allGroupPolicies
            };

        if (!filter.GetAllGroups)
        {
            query = query.Where(x => x.AllGroupPolicies.Any(y => y.PolicyId == policyId));
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

        var vms = items.Select(x => new PolicyGroup
        {
            Id = x.Id,
            Name = x.Name,
            Description = x.Description,
            IsPolicyGroup = x.AllGroupPolicies.Any(y => y.PolicyId == policyId)
        }).ToList();

        return new PagedResult<PolicyGroup>(totalCount, vms);
    }

    public async Task<PagedResult<PolicyMember>> GetMembersAsync(
        Guid organizationId,
        Guid policyId,
        PolicyMemberFilter filter)
    {
        var users = MongoDb.QueryableOf<User>();
        var organizationUsers = MongoDb.QueryableOf<OrganizationUser>();
        var memberPolicies = MongoDb.QueryableOf<MemberPolicy>();

        var query =
            from user in users
            join organizationUser in organizationUsers
                on user.Id equals organizationUser.UserId
            join memberPolicy in memberPolicies
                on user.Id equals memberPolicy.MemberId
                into allMemberPolicies
            where organizationUser.OrganizationId == organizationId
            select new
            {
                user.Id,
                user.Name,
                user.Email,
                AllMemberPolicies = allMemberPolicies,
            };

        if (!filter.GetAllMembers)
        {
            // because we have SysManaged policies that's **shared** between all organizations
            // that means one policy can be used in many organizations, which means policyId:organizationId = 1:*
            query = query.Where(
                x => x.AllMemberPolicies.Any(y => y.OrganizationId == organizationId && y.PolicyId == policyId)
            );
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

        var vms = items.Select(x => new PolicyMember
        {
            Id = x.Id,
            Name = x.Name,
            Email = x.Email,
            IsPolicyMember =
                x.AllMemberPolicies.Any(y => y.OrganizationId == organizationId && y.PolicyId == policyId),
        }).ToList();

        return new PagedResult<PolicyMember>(totalCount, vms);
    }
}