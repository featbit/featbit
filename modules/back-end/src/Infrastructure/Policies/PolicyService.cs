using Application.Bases.Exceptions;
using Application.Bases.Models;
using Application.Policies;
using Application.Services;
using Domain.Groups;
using Domain.Members;
using Domain.Organizations;
using Domain.Policies;
using Domain.Users;
using Infrastructure.MongoDb;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.Policies;

public class PolicyService : IPolicyService
{
    private readonly MongoDbClient _mongoDb;

    public PolicyService(MongoDbClient mongoDb)
    {
        _mongoDb = mongoDb;
    }

    public async Task<Policy> GetAsync(string id)
    {
        var policy = await _mongoDb.QueryableOf<Policy>().FirstOrDefaultAsync(x => x.Id == id);
        if (policy == null)
        {
            throw new EntityNotFoundException(nameof(Policy), id);
        }

        return policy;
    }

    public async Task<PagedResult<Policy>> GetListAsync(string organizationId, PolicyFilter filter)
    {
        var query = _mongoDb.QueryableOf<Policy>()
            .Where(x => x.OrganizationId == organizationId || x.Type == PolicyTypes.SysManaged);

        var name = filter.Name;
        if (!string.IsNullOrWhiteSpace(name))
        {
            query = query.Where(x => x.Name.Contains(name, StringComparison.CurrentCultureIgnoreCase));
        }

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip(filter.PageIndex * filter.PageSize)
            .OrderByDescending(x => x.CreatedAt)
            .Take(filter.PageSize)
            .ToListAsync();

        return new PagedResult<Policy>(totalCount, items);
    }

    public async Task<bool> IsNameUsedAsync(string organizationId, string name)
    {
        var isNameUsed =
            await _mongoDb.QueryableOf<Policy>().AnyAsync(x => x.OrganizationId == organizationId && x.Name == name);

        return isNameUsed;
    }

    public async Task<PagedResult<PolicyGroup>> GetGroupsAsync(
        string organizationId,
        string policyId,
        PolicyGroupFilter filter)
    {
        var groups = _mongoDb.QueryableOf<Group>();
        var groupPolicies = _mongoDb.QueryableOf<GroupPolicy>();

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
            Id = x.Id.ToString(),
            Name = x.Name,
            Description = x.Description,
            IsPolicyGroup = x.AllGroupPolicies.Any(y => y.PolicyId == policyId)
        }).ToList();

        return new PagedResult<PolicyGroup>(totalCount, vms);
    }

    public async Task<PagedResult<PolicyMember>> GetMembersAsync(
        string organizationId,
        string policyId,
        PolicyMemberFilter filter)
    {
        var users = _mongoDb.QueryableOf<User>();
        var organizationUsers = _mongoDb.QueryableOf<OrganizationUser>();
        var memberPolicies = _mongoDb.QueryableOf<MemberPolicy>();

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
            Email = x.Email,
            IsPolicyMember =
                x.AllMemberPolicies.Any(y => y.OrganizationId == organizationId && y.PolicyId == policyId),
        }).ToList();

        return new PagedResult<PolicyMember>(totalCount, vms);
    }
}