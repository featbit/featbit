using Application.Bases;
using Application.Bases.Exceptions;
using Application.Bases.Models;
using Application.EndUsers;
using Domain.EndUsers;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.Services.MongoDb;

public class EndUserService(MongoDbClient mongoDb) : MongoDbService<EndUser>(mongoDb), IEndUserService
{
    public async Task<CursorPagedResult<EndUser>> GetListAsync(Guid envId, EndUserFilter userFilter)
    {
        var filter = TranslateFilter(envId, userFilter);

        var cursor = userFilter.Cursor;
        var isBackward = cursor?.Direction == PageCursorDirection.Backward;
        var pageSize = userFilter.PageSize;
        var limit = pageSize + 1;

        var cursorFilter = cursor != null
            ? BuildCursorFilter()
            : Builders<EndUser>.Filter.Empty;

        var itemsQuery = isBackward
            ? Collection.Find(filter & cursorFilter)
                .SortBy(x => x.UpdatedAt)
                .ThenBy(x => x.Id)
                .Limit(limit)
            : Collection.Find(filter & cursorFilter)
                .SortByDescending(x => x.UpdatedAt)
                .ThenByDescending(x => x.Id)
                .Limit(limit);

        var items = await itemsQuery.ToListAsync();

        var hasMoreInRequestedDirection = items.Count > pageSize;
        if (hasMoreInRequestedDirection)
        {
            items = items.Take(pageSize).ToList();
        }

        if (isBackward)
        {
            items.Reverse();
        }

        var hasPrevious = isBackward
            ? hasMoreInRequestedDirection
            : cursor != null;

        var hasNext = isBackward
            ? cursor != null
            : hasMoreInRequestedDirection;

        var previousCursor = hasPrevious && items.Count > 0
            ? new PageCursor(items[0].Id, items[0].UpdatedAt, PageCursorDirection.Backward)
            : null;

        var nextCursor = hasNext && items.Count > 0
            ? new PageCursor(items[^1].Id, items[^1].UpdatedAt, PageCursorDirection.Forward)
            : null;

        return new CursorPagedResult<EndUser>(items, previousCursor, nextCursor);

        FilterDefinition<EndUser> BuildCursorFilter()
        {
            var builder = Builders<EndUser>.Filter;

            return cursor.Direction == PageCursorDirection.Forward
                ? builder.Or(
                    builder.Lt(x => x.UpdatedAt, cursor.UpdatedAt),
                    builder.And(
                        builder.Eq(x => x.UpdatedAt, cursor.UpdatedAt),
                        builder.Lt(x => x.Id, cursor.Id)
                    )
                )
                : builder.Or(
                    builder.Gt(x => x.UpdatedAt, cursor.UpdatedAt),
                    builder.And(
                        builder.Eq(x => x.UpdatedAt, cursor.UpdatedAt),
                        builder.Gt(x => x.Id, cursor.Id)
                    )
                );
        }
    }

    public async Task<ICollection<EndUser>> SearchAsync(Guid workspaceId, Guid envId, EndUserSearchFilter filter)
    {
        var limit = Math.Clamp(filter.Limit, 5, 50);

        var builder = Builders<EndUser>.Filter;

        var extraFilters = BuildExtraFilters();
        var globalFilter = builder.And(builder.Eq(x => x.WorkspaceId, workspaceId), extraFilters);

        if (filter.GlobalUserOnly)
        {
            var globalUsers = await Collection.Find(globalFilter)
                .SortByDescending(x => x.UpdatedAt)
                .ThenByDescending(x => x.Id)
                .Limit(limit)
                .ToListAsync();

            return globalUsers;
        }

        // Use $unionWith so each branch hits its own index (workspaceId or envId),
        // then sort + limit the merged result set — mirrors the PostgreSQL UNION ALL approach.
        var envFilter = builder.And(builder.Eq(x => x.EnvId, envId), extraFilters);
        var envPipeline = new EmptyPipelineDefinition<EndUser>().Match(envFilter);

        var users = await Collection.Aggregate()
            .Match(globalFilter)
            .UnionWith(Collection, envPipeline)
            .SortByDescending(x => x.UpdatedAt)
            .ThenByDescending(x => x.Id)
            .Limit(limit)
            .ToListAsync();

        return users;

        FilterDefinition<EndUser> BuildExtraFilters()
        {
            var extra = new List<FilterDefinition<EndUser>>();

            var text = filter.SearchText;
            if (!string.IsNullOrEmpty(text))
            {
                extra.Add(builder.Or(
                    builder.Where(x => x.KeyId.Contains(text, StringComparison.CurrentCultureIgnoreCase)),
                    builder.Where(x => x.Name.Contains(text, StringComparison.CurrentCultureIgnoreCase))
                ));
            }

            var excludedKeyIds = filter.ExcludedKeyIds ?? [];
            if (excludedKeyIds.Length != 0)
            {
                extra.Add(builder.Nin(x => x.KeyId, excludedKeyIds));
            }

            return extra.Count > 0 ? builder.And(extra) : builder.Empty;
        }
    }

    public async Task<ICollection<EndUser>> LoadEndUsersAsync(Guid envId, EndUserFilter userFilter)
    {
        var filter = TranslateFilter(envId, userFilter);

        var total = await Collection.CountDocumentsAsync(filter);
        if (total > EndUserConstants.EndUserLoadLimit)
        {
            throw new BusinessException(ErrorCodes.EndUserLimitExceeded);
        }

        var users = await Collection.Find(filter).ToListAsync();
        return users;
    }

    public async Task<EndUser> UpsertAsync(EndUser user)
    {
        var existed = await Queryable.FirstOrDefaultAsync(x => x.EnvId == user.EnvId && x.KeyId == user.KeyId);
        if (existed == null)
        {
            await Collection.InsertOneAsync(user);
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

        // https://www.mongodb.com/docs/manual/reference/method/db.collection.bulkWrite/
        var writeModels = new List<WriteModel<EndUser>>();
        foreach (var endUser in endUsers)
        {
            var existing = existUsers.FirstOrDefault(x => x.KeyId == endUser.KeyId);
            if (existing == null)
            {
                // insert new user
                var insertOneModel = new InsertOneModel<EndUser>(endUser);
                writeModels.Add(insertOneModel);
            }
            else
            {
                // no need to update if value equals
                if (existing.ValueEquals(endUser))
                {
                    continue;
                }

                // update existing user
                var filter = Builders<EndUser>.Filter.And(
                    Builders<EndUser>.Filter.Eq(x => x.WorkspaceId, workspaceId),
                    Builders<EndUser>.Filter.Eq(x => x.EnvId, envId),
                    Builders<EndUser>.Filter.Eq(x => x.KeyId, endUser.KeyId)
                );

                var update = Builders<EndUser>.Update
                    .Set(x => x.Name, endUser.Name)
                    .Set(x => x.CustomizedProperties, endUser.CustomizedProperties);

                var updateOneModel = new UpdateOneModel<EndUser>(filter, update);
                writeModels.Add(updateOneModel);
            }
        }

        if (!writeModels.Any())
        {
            return ImportUserResult.Ok(0, 0);
        }

        var result = await Collection.BulkWriteAsync(writeModels);
        return result.IsAcknowledged
            ? ImportUserResult.Ok(result.InsertedCount, result.ModifiedCount)
            : ImportUserResult.Fail();
    }

    public async Task<EndUserProperty[]> AddNewPropertiesAsync(EndUser user)
    {
        var customizedProperties = user.CustomizedProperties;
        if (customizedProperties == null || !customizedProperties.Any())
        {
            return Array.Empty<EndUserProperty>();
        }

        var messageProperties = customizedProperties.Select(x => x.Name);
        var currentProperties = await MongoDb.QueryableOf<EndUserProperty>()
            .Where(x => x.EnvId == user.EnvId)
            .Select(x => x.Name)
            .ToListAsync();

        var newProperties = messageProperties
            .Where(x => currentProperties.All(y => y != x))
            .Select(x => new EndUserProperty(user.EnvId.GetValueOrDefault(), x, Array.Empty<EndUserPresetValue>()))
            .ToArray();

        if (newProperties.Any())
        {
            await MongoDb.CollectionOf<EndUserProperty>().InsertManyAsync(newProperties);
        }

        return newProperties;
    }

    public async Task<EndUserProperty[]> AddNewPropertiesAsync(Guid envId, IEnumerable<string> propertyNames)
    {
        var existingPropNames = await MongoDb.QueryableOf<EndUserProperty>()
            .Where(x => x.EnvId == envId)
            .Select(x => x.Name)
            .ToListAsync();

        var newProps = propertyNames
            .Where(propName => !existingPropNames.Contains(propName))
            .Select(propName => new EndUserProperty(envId, propName))
            .ToArray();

        if (newProps.Length != 0)
        {
            await MongoDb.CollectionOf<EndUserProperty>().InsertManyAsync(newProps);
        }

        return newProps;
    }

    public async Task<ICollection<EndUserProperty>> GetPropertiesAsync(Guid envId)
    {
        var properties = await MongoDb.QueryableOf<EndUserProperty>()
            .Where(x => x.EnvId == envId)
            .ToListAsync();

        return properties;
    }

    public async Task<EndUserProperty> UpsertPropertyAsync(EndUserProperty property)
    {
        var properties = MongoDb.CollectionOf<EndUserProperty>();

        // update existed
        var existed = await properties.AsQueryable().FirstOrDefaultAsync(x => x.Id == property.Id);
        if (existed != null)
        {
            if (existed.IsBuiltIn)
            {
                throw new BusinessException(ErrorCodes.CannotModifyBuiltInProperty);
            }

            existed.Update(property);

            await properties.ReplaceOneAsync(x => x.Id == existed.Id, existed);
            return existed;
        }

        // insert new
        await properties.InsertOneAsync(property);
        return property;
    }

    public async Task DeletePropertyAsync(Guid propertyId)
    {
        var property = await MongoDb.QueryableOf<EndUserProperty>()
            .FirstOrDefaultAsync(x => x.Id == propertyId);
        if (property == null)
        {
            return;
        }

        if (property.IsBuiltIn)
        {
            throw new BusinessException(ErrorCodes.CannotModifyBuiltInProperty);
        }

        await MongoDb.CollectionOf<EndUserProperty>().DeleteOneAsync(x => x.Id == propertyId);
    }

    private static FilterDefinition<EndUser> TranslateFilter(Guid envId, EndUserFilter userFilter)
    {
        var filterBuilder = Builders<EndUser>.Filter;

        var baseFilter = filterBuilder.Eq(x => x.EnvId, envId);

        var mustFilters = new List<FilterDefinition<EndUser>>
        {
            baseFilter
        };

        var orFilters = new List<FilterDefinition<EndUser>>();

        // built-in properties

        // mongodb not support ordinal comparisons yet, use StringComparison.CurrentCultureIgnoreCase
        // https://jira.mongodb.org/browse/CSHARP-4090#:~:text=until%20the%20database%20supports%20ordinal%20comparisons.

        var searchText = userFilter.SearchText;
        if (!string.IsNullOrWhiteSpace(searchText))
        {
            var keyIdFilter =
                filterBuilder.Where(x => x.KeyId.Contains(searchText, StringComparison.CurrentCultureIgnoreCase));
            orFilters.Add(keyIdFilter);

            var nameFilter =
                filterBuilder.Where(x => x.Name.Contains(searchText, StringComparison.CurrentCultureIgnoreCase));
            orFilters.Add(nameFilter);
        }

        var filter = filterBuilder.And(mustFilters);
        if (orFilters.Count != 0)
        {
            filter &= filterBuilder.Or(orFilters);
        }

        return filter;
    }
}