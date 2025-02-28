using Application.Bases.Models;
using Application.Policies;
using Domain.Groups;
using Domain.Members;
using Domain.Organizations;
using Domain.Policies;
using Domain.Users;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services.EntityFrameworkCore;

public class PolicyService(AppDbContext dbContext) : EntityFrameworkCoreService<Policy>(dbContext), IPolicyService
{
    public async Task DeleteAsync(Guid id)
    {
        // delete policy
        await DeleteOneAsync(id);

        // delete policy groups
        await SetOf<GroupPolicy>().Where(x => x.PolicyId == id).ExecuteDeleteAsync();

        // delete policy members
        await SetOf<MemberPolicy>().Where(x => x.PolicyId == id).ExecuteDeleteAsync();
    }

    public async Task<PagedResult<Policy>> GetListAsync(Guid organizationId, PolicyFilter filter)
    {
        var query = QueryableOf<Policy>()
            .Where(x => x.OrganizationId == organizationId || x.Type == PolicyTypes.SysManaged);

        var name = filter.Name?.ToLower();
        if (!string.IsNullOrWhiteSpace(name))
        {
            query = query.Where(x => x.Name.ToLower().Contains(name));
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
        var groups = QueryableOf<Group>();
        var groupPolicies = QueryableOf<GroupPolicy>();

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
        var name = filter.Name?.ToLower();
        if (!string.IsNullOrWhiteSpace(name))
        {
            query = query.Where(x => x.Name.ToLower().Contains(name));
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
        var users = QueryableOf<User>();
        var organizationUsers = QueryableOf<OrganizationUser>();
        var memberPolicies = QueryableOf<MemberPolicy>();

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
        var searchText = filter.SearchText?.ToLower();
        if (!string.IsNullOrWhiteSpace(searchText))
        {
            query = query.Where(x => x.Email.ToLower().Contains(searchText));
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

    public async Task<bool> IsNameUsedAsync(Guid organizationId, string name)
    {
        return await AnyAsync(x =>
            x.OrganizationId == organizationId &&
            string.Equals(x.Name.ToLower(), name.ToLower())
        );
    }
}