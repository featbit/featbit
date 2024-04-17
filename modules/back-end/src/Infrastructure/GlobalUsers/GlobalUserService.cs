using Application.Bases.Exceptions;
using Application.Bases.Models;
using Application.GlobalUsers;
using Domain.EndUsers;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.GlobalUsers;

public class GlobalUserService : MongoDbService<GlobalUser>, IGlobalUserService
{
    public GlobalUserService(MongoDbClient mongoDb) : base(mongoDb)
    {
    }

    public async Task<PagedResult<GlobalUser>> GetListAsync(Guid workspaceId, GlobalUserFilter filter)
    {
        var query = Queryable.Where(x => x.WorkspaceId == workspaceId);

        var name = filter.Name;
        if (!string.IsNullOrEmpty(name))
        {
            query = query.Where(x => x.Name.Contains(name, StringComparison.CurrentCultureIgnoreCase));
        }

        var total = await query.CountAsync();
        var data = await query
            .Skip(filter.PageIndex * filter.PageSize)
            .Take(filter.PageSize)
            .ToListAsync();

        return new PagedResult<GlobalUser>(total, data);
    }

    public async Task<ImportUserResult> UpsertAsync(Guid workspaceId, IEnumerable<GlobalUser> users)
    {
        var total = await Queryable.Where(x => x.WorkspaceId == workspaceId).LongCountAsync();
        if (total > 5 * 10000)
        {
            throw new BusinessException("The number of global users exceeds the limit.");
        }

        // load all global users into memory
        var existUsers = await Queryable
            .Where(x => x.WorkspaceId == workspaceId)
            .ToListAsync();

        var writeModels = new List<WriteModel<GlobalUser>>();
        foreach (var user in users)
        {
            var existing = existUsers.FirstOrDefault(x => x.KeyId == user.KeyId);
            if (existing == null)
            {
                var insertOneModel = new InsertOneModel<GlobalUser>(user);
                writeModels.Add(insertOneModel);
            }
            else
            {
                // no need to update if value equals
                if (existing.ValueEquals(user))
                {
                    continue;
                }

                // update existing user
                var filter = Builders<GlobalUser>.Filter.And(
                    Builders<GlobalUser>.Filter.Eq(x => x.WorkspaceId, workspaceId),
                    Builders<GlobalUser>.Filter.Eq(x => x.KeyId, user.KeyId)
                );

                var update = Builders<GlobalUser>.Update
                    .Set(x => x.Name, user.Name)
                    .Set(x => x.CustomizedProperties, user.CustomizedProperties);

                var updateOneModel = new UpdateOneModel<GlobalUser>(filter, update);
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
}