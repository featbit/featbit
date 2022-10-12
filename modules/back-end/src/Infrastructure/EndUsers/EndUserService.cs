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

        var filters = new List<FilterDefinition<EndUser>>();

        #region built-in properties filter

        // mongodb not support ordinal comparisons yet, use StringComparison.CurrentCultureIgnoreCase
        // https://jira.mongodb.org/browse/CSHARP-4090#:~:text=until%20the%20database%20supports%20ordinal%20comparisons.

        var keyId = userFilter.KeyId;
        if (!string.IsNullOrWhiteSpace(keyId))
        {
            var keyIdFilter =
                filterBuilder.Where(x => x.KeyId.Contains(keyId, StringComparison.CurrentCultureIgnoreCase));
            filters.Add(keyIdFilter);
        }

        var name = userFilter.Name;
        if (!string.IsNullOrWhiteSpace(name))
        {
            var nameFilter = filterBuilder.Where(x => x.Name.Contains(name, StringComparison.CurrentCultureIgnoreCase));
            filters.Add(nameFilter);
        }

        #endregion

        #region custom properties filter

        var customizedProperties = userFilter.CustomizedProperties ?? new List<EndUserCustomizedProperty>();
        foreach (var customizedProperty in customizedProperties)
        {
            var customizedPropertyFilter = filterBuilder.ElemMatch(
                x => x.CustomizedProperties,
                y => y.Name == customizedProperty.Name &&
                     y.Value.Contains(customizedProperty.Value, StringComparison.CurrentCultureIgnoreCase)
            );

            filters.Add(customizedPropertyFilter);
        }

        #endregion

        var filter = filterBuilder.Eq(x => x.EnvId, envId);
        if (filters.Any())
        {
            filter &= filterBuilder.Or(filters);
        }

        var endUsers = MongoDb.CollectionOf<EndUser>();

        var totalCount = await endUsers.CountDocumentsAsync(filter);
        var itemsQuery = endUsers
            .Find(filter)
            .Sort("{_id: -1}")
            .Skip(userFilter.PageIndex * userFilter.PageSize)
            .Limit(userFilter.PageSize);
        var items = await itemsQuery.ToListAsync();

        return new PagedResult<EndUser>(totalCount, items);
    }

    public async Task<EndUser> UpsertAsync(EndUser user)
    {
        var users = MongoDb.CollectionOf<EndUser>();

        var existed = await users.AsQueryable()
            .FirstOrDefaultAsync(x => x.EnvId == user.EnvId && x.KeyId == user.KeyId);

        // update existed
        if (existed != null)
        {
            existed.Update(user.Name, user.CustomizedProperties);
            await UpdateAsync(existed);

            return existed;
        }

        // insert new
        await users.InsertOneAsync(user);
        return user;
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