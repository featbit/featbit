using Application.Bases;
using Application.Bases.Exceptions;
using Application.Bases.Models;
using Application.EndUsers;
using Domain.EndUsers;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.EndUsers;

public class EndUserService : MongoDbService<EndUser>, IEndUserService
{
    public EndUserService(MongoDbClient mongoDb) : base(mongoDb)
    {
    }

    public async Task<PagedResult<EndUser>> GetListAsync(Guid envId, EndUserFilter userFilter)
    {
        var filterBuilder = Builders<EndUser>.Filter;

        var envIdFilter = userFilter.IncludeGlobalUser
            ? filterBuilder.Or(
                filterBuilder.Eq(x => x.EnvId, envId),
                filterBuilder.Eq(x => x.EnvId, null)
            )
            : filterBuilder.Eq(x => x.EnvId, envId);

        var mustFilters = new List<FilterDefinition<EndUser>>
        {
            envIdFilter
        };

        // excluded keyIds
        var excludedKeyIds = userFilter.ExcludedKeyIds ?? Array.Empty<string>();
        if (excludedKeyIds.Any())
        {
            var excludedKeyIdsFilter = filterBuilder.Nin(x => x.KeyId, excludedKeyIds);
            mustFilters.Add(excludedKeyIdsFilter);
        }

        var orFilters = new List<FilterDefinition<EndUser>>();

        // built-in properties

        // mongodb not support ordinal comparisons yet, use StringComparison.CurrentCultureIgnoreCase
        // https://jira.mongodb.org/browse/CSHARP-4090#:~:text=until%20the%20database%20supports%20ordinal%20comparisons.

        var keyId = userFilter.KeyId;
        if (!string.IsNullOrWhiteSpace(keyId))
        {
            var keyIdFilter =
                filterBuilder.Where(x => x.KeyId.Contains(keyId, StringComparison.CurrentCultureIgnoreCase));
            orFilters.Add(keyIdFilter);
        }

        var name = userFilter.Name;
        if (!string.IsNullOrWhiteSpace(name))
        {
            var nameFilter = filterBuilder.Where(x => x.Name.Contains(name, StringComparison.CurrentCultureIgnoreCase));
            orFilters.Add(nameFilter);
        }

        // custom properties
        var customizedProperties = userFilter.CustomizedProperties ?? new List<EndUserCustomizedProperty>();
        foreach (var customizedProperty in customizedProperties)
        {
            var customizedPropertyFilter = filterBuilder.ElemMatch(
                x => x.CustomizedProperties,
                y => y.Name == customizedProperty.Name &&
                     y.Value.Contains(customizedProperty.Value, StringComparison.CurrentCultureIgnoreCase)
            );

            orFilters.Add(customizedPropertyFilter);
        }

        var filter = filterBuilder.And(mustFilters);
        if (orFilters.Any())
        {
            filter &= filterBuilder.Or(orFilters);
        }

        var totalCount = await Collection.CountDocumentsAsync(filter);
        var itemsQuery = Collection
            .Find(filter)
            .SortByDescending(x => x.UpdatedAt)
            .Skip(userFilter.PageIndex * userFilter.PageSize)
            .Limit(userFilter.PageSize);
        var items = await itemsQuery.ToListAsync();

        return new PagedResult<EndUser>(totalCount, items);
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

        if (newProps.Any())
        {
            await MongoDb.CollectionOf<EndUserProperty>().InsertManyAsync(newProps);
        }

        return newProps;
    }

    public async Task<IEnumerable<EndUserProperty>> GetPropertiesAsync(Guid envId)
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
}