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
    public async Task<CursorPagedResult<EndUser>> GetListAsync(Guid envId, EndUserFilter userFilter)
    {
        var filterQuery = TranslateFilter(envId, userFilter);

        var cursor = userFilter.Cursor;
        var isBackward = cursor?.Direction == PageCursorDirection.Backward;
        var pageSize = userFilter.PageSize;
        var takeCount = pageSize + 1;

        var usersQuery = filterQuery.Clone();

        if (cursor != null)
        {
            usersQuery = cursor.Direction == PageCursorDirection.Forward
                ? usersQuery.WhereRaw("(updated_at, id) < (?, ?)", cursor.UpdatedAt, cursor.Id)
                : usersQuery.WhereRaw("(updated_at, id) > (?, ?)", cursor.UpdatedAt, cursor.Id);
        }

        usersQuery = isBackward
            ? usersQuery
                .OrderBy("updated_at")
                .OrderBy("id")
                .Take(takeCount)
            : usersQuery
                .OrderByDesc("updated_at")
                .OrderByDesc("id")
                .Take(takeCount);

        var pgCompiler = new PostgresCompiler();
        var usersSr = pgCompiler.Compile(usersQuery);
        var users =
            (await DbConnection.QueryAsync<EndUser>(usersSr.Sql, usersSr.NamedBindings)).AsList();

        var hasMoreInRequestedDirection = users.Count > pageSize;
        if (hasMoreInRequestedDirection)
        {
            users = users.Take(pageSize).ToList();
        }

        if (isBackward)
        {
            users.Reverse();
        }

        var hasPrevious = isBackward
            ? hasMoreInRequestedDirection
            : cursor != null;

        var hasNext = isBackward
            ? cursor != null
            : hasMoreInRequestedDirection;

        var previousCursor = hasPrevious && users.Count > 0
            ? new PageCursor(users[0].Id, users[0].UpdatedAt, PageCursorDirection.Backward)
            : null;

        var nextCursor = hasNext && users.Count > 0
            ? new PageCursor(users[^1].Id, users[^1].UpdatedAt, PageCursorDirection.Forward)
            : null;

        return new CursorPagedResult<EndUser>(users, previousCursor, nextCursor);
    }

    public async Task<ICollection<EndUser>> SearchAsync(Guid workspaceId, Guid envId, EndUserSearchFilter filter)
    {
        var limit = Math.Clamp(filter.Limit, 5, 50);

        Query query;
        if (filter.GlobalUserOnly)
        {
            query = ApplyFilters(new Query("end_users").Where("workspace_id", workspaceId));
        }
        else
        {
            // Do not use "where (workspace_id = ? OR env_id = ?)" here because it can't utilize the index efficiently
            // when the table grows large.
            // Use UNION ALL so each branch hits its own index (workspace_id or env_id),
            // and then let PostgreSQL sort the combined result set in a single query.
            var globalQuery = ApplyFilters(new Query("end_users").Where("workspace_id", workspaceId));
            var envQuery = ApplyFilters(new Query("end_users").Where("env_id", envId));

            query = new Query().From(globalQuery.UnionAll(envQuery).As("combined"));
        }

        query = query
            .OrderByDesc("updated_at")
            .OrderByDesc("id")
            .Take(limit);

        var pgCompiler = new PostgresCompiler();
        var sqlResult = pgCompiler.Compile(query);

        var users =
            (await DbConnection.QueryAsync<EndUser>(sqlResult.Sql, sqlResult.NamedBindings)).AsList();
        return users;

        Query ApplyFilters(Query baseQuery)
        {
            var text = filter.SearchText;
            if (!string.IsNullOrEmpty(text))
            {
                baseQuery = baseQuery.Where(
                    x => x.OrWhereContains("key_id", text).OrWhereContains("name", text)
                );
            }

            var excludedKeyIds = filter.ExcludedKeyIds ?? [];
            if (excludedKeyIds.Length != 0)
            {
                baseQuery = baseQuery.WhereNotIn("key_id", excludedKeyIds);
            }

            return baseQuery;
        }
    }

    public async Task<ICollection<EndUser>> LoadEndUsersAsync(Guid envId, EndUserFilter userFilter)
    {
        var baseQuery = TranslateFilter(envId, userFilter);

        var pgCompiler = new PostgresCompiler();
        var countSr = pgCompiler.Compile(
            baseQuery.Clone().AsCount()
        );

        var total = await DbConnection.ExecuteScalarAsync<int>(countSr.Sql, countSr.NamedBindings);
        if (total > EndUserConstants.EndUserLoadLimit)
        {
            throw new BusinessException(ErrorCodes.EndUserLimitExceeded);
        }

        var sqlResult = pgCompiler.Compile(baseQuery.Clone());
        var users = await DbConnection.QueryAsync<EndUser>(sqlResult.Sql, sqlResult.NamedBindings);
        return users.AsList();
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

    public async Task<ImportUserResult> UpsertAsync(Guid? workspaceId, Guid? envId, EndUser[] endUsers)
    {
        List<EndUser> existUsers;

        var keyIds = endUsers.Select(x => x.KeyId).Distinct().ToArray();
        if (keyIds.Length < 1_000)
        {
            // for small batch, only load the users with the same keyIds to reduce memory usage
            existUsers = await Queryable
                .Where(x => x.WorkspaceId == workspaceId && x.EnvId == envId && keyIds.Contains(x.KeyId))
                .ToListAsync();
        }
        else
        {
            // for large batch, load all users to avoid the performance issue of "where in" with too many keyIds
            var total = await Queryable.Where(x => x.WorkspaceId == workspaceId && x.EnvId == envId).LongCountAsync();
            if (total > EndUserConstants.EndUserLoadLimit)
            {
                throw new BusinessException(ErrorCodes.EndUserLimitExceeded);
            }

            existUsers = await Queryable
                .Where(x => x.WorkspaceId == workspaceId && x.EnvId == envId)
                .ToListAsync();
        }

        var insertedCount = 0;
        var modifiedCount = 0;

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

    private static Query TranslateFilter(Guid envId, EndUserFilter userFilter)
    {
        var query = new Query("end_users").Where("env_id", envId);

        var text = userFilter.SearchText;
        if (!string.IsNullOrEmpty(text))
        {
            query = query.Where(
                x => x.OrWhereContains("key_id", text).OrWhereContains("name", text)
            );
        }

        return query;
    }
}