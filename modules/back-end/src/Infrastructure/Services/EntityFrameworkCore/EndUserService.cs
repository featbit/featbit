using Application.Bases;
using Application.Bases.Exceptions;
using Application.Bases.Models;
using Application.EndUsers;
using Dapper;
using Domain.EndUsers;
using Microsoft.EntityFrameworkCore;
using SqlKata;
using SqlKata.Compilers;

namespace Infrastructure.Services.EntityFrameworkCore;

public class EndUserService(AppDbContext dbContext)
    : EntityFrameworkCoreService<EndUser>(dbContext), IEndUserService
{
    public async Task<PagedResult<EndUser>> GetListAsync(Guid workspaceId, Guid envId, EndUserFilter userFilter)
    {
        var table = new Query("end_users");

        var baseQuery = userFilter.GlobalUserOnly
            ? table.Where("workspace_id", workspaceId)
            : userFilter.IncludeGlobalUser
                ? table.Where(
                    x => x.Where("workspace_id", workspaceId).OrWhere("env_id", envId)
                )
                : table.Where("env_id", envId);

        var pgCompiler = new PostgresCompiler();

        // excluded keyIds
        var excludedKeyIds = userFilter.ExcludedKeyIds ?? [];
        if (excludedKeyIds.Length != 0)
        {
            baseQuery.WhereNotIn("key_id", excludedKeyIds);
        }

        var name = userFilter.Name;
        var keyId = userFilter.KeyId;
        var customizedProperties = userFilter.CustomizedProperties ?? [];

        baseQuery.Where(
            group => group
                .When(!string.IsNullOrWhiteSpace(keyId), q => q.OrWhereContains("key_id", keyId))
                .When(!string.IsNullOrWhiteSpace(name), q => q.OrWhereContains("name", name))
                .When(customizedProperties.Count > 0, q =>
                {
                    List<object> parameters = [];

                    var wheres = customizedProperties.Select(cp =>
                    {
                        parameters.Add(cp.Name);
                        parameters.Add($"%{cp.Value}%");

                        return "(cp->>'name'= ? and cp->>'value' ilike ?)";
                    });
                    var where = string.Join(" or ", wheres);

                    return q.OrWhereRaw(
                        $"exists(select 1 from jsonb_array_elements(customized_properties) as cp where {where})",
                        parameters.ToArray()
                    );
                })
        );

        var countSr = pgCompiler.Compile(
            baseQuery.Clone().AsCount()
        );
        var itemsSr = pgCompiler.Compile(
            baseQuery
                .Clone()
                .OrderByDesc("updated_at")
                .Skip(userFilter.PageIndex * userFilter.PageSize)
                .Take(userFilter.PageSize)
        );

        var totalCount = await DbConnection.ExecuteScalarAsync<int>(countSr.Sql, countSr.NamedBindings);
        var items = await DbConnection.QueryAsync<EndUser>(itemsSr.Sql, itemsSr.NamedBindings);

        return new PagedResult<EndUser>(totalCount, items.AsList());
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
            return [];
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

    public async Task<ICollection<EndUserProperty>> GetPropertiesAsync(Guid envId)
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