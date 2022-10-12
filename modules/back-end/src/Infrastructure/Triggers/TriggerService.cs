using Domain.Triggers;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.Triggers;

public class TriggerService : MongoDbService<Trigger>, ITriggerService
{
    public TriggerService(MongoDbClient mongoDb) : base(mongoDb)
    {
    }

    public async Task<ICollection<Trigger>> GetListAsync(Guid targetId)
    {
        return await Queryable.Where(x => x.TargetId == targetId).ToListAsync();
    }

    public async Task DeleteAsync(Guid id)
    {
        await Collection.DeleteOneAsync(x => x.Id == id);
    }
}