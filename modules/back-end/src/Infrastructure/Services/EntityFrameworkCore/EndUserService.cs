using System.Linq.Expressions;
using Application.Bases;
using Application.Bases.Exceptions;
using Application.Bases.Models;
using Application.EndUsers;
using Domain.EndUsers;
using LinqKit;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services.EntityFrameworkCore;

public class EndUserService(AppDbContext dbContext)
    : EntityFrameworkCoreService<EndUser>(dbContext), IEndUserService
{
    public async Task<PagedResult<EndUser>> GetListAsync(Guid workspaceId, Guid envId, EndUserFilter userFilter)
    {
        Expression<Func<EndUser, bool>> globalUserFilter = x => x.WorkspaceId == workspaceId && x.EnvId == null;
        Expression<Func<EndUser, bool>> envUserFilter = x => x.EnvId == envId;

        var baseFilter = userFilter.GlobalUserOnly
            ? globalUserFilter
            : userFilter.IncludeGlobalUser
                ? globalUserFilter.Or(envUserFilter)
                : envUserFilter;

        // excluded keyIds
        var excludedKeyIds = userFilter.ExcludedKeyIds ?? Array.Empty<string>();
        if (excludedKeyIds.Any())
        {
            baseFilter.And(x => !excludedKeyIds.Contains(x.KeyId));
        }

        Expression<Func<EndUser, bool>> orFilters = PredicateBuilder.New<EndUser>(true);

        // built-in properties

        // mongodb not support ordinal comparisons yet, use StringComparison.CurrentCultureIgnoreCase
        // https://jira.mongodb.org/browse/CSHARP-4090#:~:text=until%20the%20database%20supports%20ordinal%20comparisons.

        var keyId = userFilter.KeyId;
        if (!string.IsNullOrWhiteSpace(keyId))
        {
            orFilters.Or(x => x.KeyId.Contains(keyId, StringComparison.CurrentCultureIgnoreCase));
        }

        var name = userFilter.Name;
        if (!string.IsNullOrWhiteSpace(name))
        {
            orFilters.Or(x => x.Name.Contains(name, StringComparison.CurrentCultureIgnoreCase));
        }

        // custom properties
        var customizedProperties = userFilter.CustomizedProperties ?? new List<EndUserCustomizedProperty>();
        foreach (var customizedProperty in customizedProperties)
        {
            orFilters.Or(x => x.CustomizedProperties.Any(y =>
                y.Name == customizedProperty.Name &&
                y.Value.Contains(customizedProperty.Value, StringComparison.CurrentCultureIgnoreCase)
            ));
        }

        var filter = baseFilter.And(orFilters);
        var query = Queryable.Where(filter);

        var totalCount = await query.LongCountAsync();
        var itemsQuery = query
            .OrderByDescending(x => x.UpdatedAt)
            .Skip(userFilter.PageIndex * userFilter.PageSize)
            .Take(userFilter.PageSize);
        var items = await itemsQuery.ToListAsync();

        return new PagedResult<EndUser>(totalCount, items);
    }

    public async Task<EndUser> UpsertAsync(EndUser user)
    {
        var existed = await Queryable.FirstOrDefaultAsync(x => x.EnvId == user.EnvId && x.KeyId == user.KeyId);
        if (existed == null)
        {
            await AddOneAsync(user);
        }
        else if (!existed.ValueEquals(user))
        {
            existed.Update(user.Name, user.CustomizedProperties);
            await UpdateAsync(existed);
        }

        return user;
    }

    public async Task<ImportUserResult> UpsertAsync(Guid? workspaceId, Guid? envId, IEnumerable<EndUser> endUsers)
    {
        var total = await Queryable.Where(x => x.WorkspaceId == workspaceId && x.EnvId == envId).LongCountAsync();
        if (total > 5 * 10000)
        {
            throw new BusinessException("The number of end users exceeds the limit.");
        }

        // load all end users into memory
        var existUsers = await Queryable
            .Where(x => x.WorkspaceId == workspaceId && x.EnvId == envId)
            .ToListAsync();

        var insertedCount = 0;
        var modifiedCount = 0;

        // https://www.mongodb.com/docs/manual/reference/method/db.collection.bulkWrite/
        foreach (var endUser in endUsers)
        {
            var existing = existUsers.FirstOrDefault(x => x.KeyId == endUser.KeyId);
            if (existing == null)
            {
                // insert new user
                Set.Add(endUser);
                insertedCount++;
            }
            else
            {
                // no need to update if value equals
                if (existing.ValueEquals(endUser))
                {
                    continue;
                }

                // update existing user
                existing.Update(endUser.Name, endUser.CustomizedProperties);
                Set.Update(existing);
                modifiedCount++;
            }
        }

        await SaveChangesAsync();

        return ImportUserResult.Ok(insertedCount, modifiedCount);
    }

    public async Task<EndUserProperty[]> AddNewPropertiesAsync(EndUser user)
    {
        var properties = SetOf<EndUserProperty>();

        var customizedProperties = user.CustomizedProperties;
        if (customizedProperties == null || !customizedProperties.Any())
        {
            return Array.Empty<EndUserProperty>();
        }

        var messageProperties = customizedProperties.Select(x => x.Name);
        var currentProperties = await QueryableOf<EndUserProperty>()
            .Where(x => x.EnvId == user.EnvId)
            .Select(x => x.Name)
            .ToListAsync();

        var newProperties = messageProperties
            .Where(x => currentProperties.All(y => y != x))
            .Select(x => new EndUserProperty(user.EnvId.GetValueOrDefault(), x, Array.Empty<EndUserPresetValue>()))
            .ToArray();

        if (newProperties.Length != 0)
        {
            properties.AddRange(newProperties);
            await SaveChangesAsync();
        }

        return newProperties;
    }

    public async Task<EndUserProperty[]> AddNewPropertiesAsync(Guid envId, IEnumerable<string> propertyNames)
    {
        var properties = SetOf<EndUserProperty>();

        var existingPropNames = await properties
            .Where(x => x.EnvId == envId)
            .Select(x => x.Name)
            .ToListAsync();

        var newProps = propertyNames
            .Where(propName => !existingPropNames.Contains(propName))
            .Select(propName => new EndUserProperty(envId, propName))
            .ToArray();

        if (newProps.Length != 0)
        {
            properties.AddRange(newProps);
            await SaveChangesAsync();
        }

        return newProps;
    }

    public async Task<IEnumerable<EndUserProperty>> GetPropertiesAsync(Guid envId)
    {
        var properties = await QueryableOf<EndUserProperty>()
            .Where(x => x.EnvId == envId)
            .ToListAsync();

        return properties;
    }

    public async Task<EndUserProperty> UpsertPropertyAsync(EndUserProperty property)
    {
        var properties = SetOf<EndUserProperty>();

        var existed = await properties.AsQueryable().FirstOrDefaultAsync(x => x.Id == property.Id);
        if (existed != null)
        {
            if (existed.IsBuiltIn)
            {
                throw new BusinessException(ErrorCodes.CannotModifyBuiltInProperty);
            }

            existed.Update(property);

            // update existed
            properties.Update(property);
        }
        else
        {
            // insert new
            properties.Add(property);
        }

        await SaveChangesAsync();

        return property;
    }

    public async Task DeletePropertyAsync(Guid propertyId)
    {
        var properties = SetOf<EndUserProperty>();

        var property = await properties.FirstOrDefaultAsync(x => x.Id == propertyId);
        if (property == null)
        {
            return;
        }

        if (property.IsBuiltIn)
        {
            throw new BusinessException(ErrorCodes.CannotModifyBuiltInProperty);
        }

        await properties.Where(x => x.Id == propertyId).ExecuteDeleteAsync();
    }
}