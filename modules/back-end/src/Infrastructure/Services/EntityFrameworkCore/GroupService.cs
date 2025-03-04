using Application.Bases.Models;
using Application.Groups;
using Domain.Groups;
using Domain.Organizations;
using Domain.Policies;
using Domain.Users;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services.EntityFrameworkCore;

public class GroupService(AppDbContext dbContext) : EntityFrameworkCoreService<Group>(dbContext), IGroupService
{
    public async Task DeleteAsync(Guid id)
    {
        // delete group
        await DeleteOneAsync(id);

        // delete group member
        await SetOf<GroupMember>().Where(x => x.GroupId == id).ExecuteDeleteAsync();

        // delete group policy
        await SetOf<GroupPolicy>().Where(x => x.GroupId == id).ExecuteDeleteAsync();
    }

    public async Task<PagedResult<Group>> GetListAsync(Guid organizationId, GroupFilter groupFilter)
    {
        var query = Queryable.Where(x => x.OrganizationId == organizationId);

        // name filter
        var name = groupFilter.Name?.ToLower();
        if (!string.IsNullOrWhiteSpace(name))
        {
            query = query.Where(x => x.Name.ToLower().Contains(name));
        }

        var totalCount = await query.CountAsync();
        var itemsQuery = query
            .OrderByDescending(x => x.UpdatedAt)
            .Skip(groupFilter.PageIndex * groupFilter.PageSize)
            .Take(groupFilter.PageSize);

        var items = await itemsQuery.ToListAsync();

        return new PagedResult<Group>(totalCount, items);
    }

    public async Task<PagedResult<GroupMemberVm>> GetMembersAsync(
        Guid organizationId,
        Guid groupId,
        GroupMemberFilter filter)
    {
        var members = QueryableOf<User>();
        var organizationUsers = QueryableOf<OrganizationUser>();
        var groupMembers = QueryableOf<GroupMember>();

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
        var policies = QueryableOf<Policy>();
        var groupPolicies = QueryableOf<GroupPolicy>();

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
        var existed = await QueryableOf<GroupMember>()
            .CountAsync(x => x.OrganizationId == organizationId && x.GroupId == groupId && x.MemberId == memberId) > 0;
        if (existed)
        {
            return;
        }

        var groupMember = new GroupMember(groupId, organizationId, memberId);
        SetOf<GroupMember>().Add(groupMember);

        await SaveChangesAsync();
    }

    public async Task RemoveMemberAsync(Guid groupId, Guid memberId)
    {
        await SetOf<GroupMember>()
            .Where(x => x.GroupId == groupId && x.MemberId == memberId)
            .ExecuteDeleteAsync();
    }

    public async Task AddPolicyAsync(Guid groupId, Guid policyId)
    {
        var existed = await QueryableOf<GroupPolicy>().CountAsync(x => x.GroupId == groupId && x.PolicyId == policyId) >
                      0;
        if (existed)
        {
            return;
        }

        var groupPolicy = new GroupPolicy(groupId, policyId);
        SetOf<GroupPolicy>().Add(groupPolicy);

        await SaveChangesAsync();
    }

    public async Task RemovePolicyAsync(Guid groupId, Guid policyId)
    {
        await SetOf<GroupPolicy>()
            .Where(x => x.GroupId == groupId && x.PolicyId == policyId)
            .ExecuteDeleteAsync();
    }

    public Task<bool> IsNameUsedAsync(Guid organizationId, string name)
    {
        var isNameUsed = AnyAsync(x =>
            x.OrganizationId == organizationId &&
            string.Equals(x.Name.ToLower(), name.ToLower())
        );

        return isNameUsed;
    }
}