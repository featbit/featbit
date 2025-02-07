using Domain.FlagChangeRequests;
using MongoDB.Driver;

namespace Infrastructure.Services.MongoDb;

public class FlagChangeRequestService : MongoDbService<FlagChangeRequest>, IFlagChangeRequestService
{
    public FlagChangeRequestService(MongoDbClient mongoDb) : base(mongoDb)
    {
    }

    public async Task DeleteAsync(Guid id)
    {
        await Collection.DeleteOneAsync(x => x.Id == id);
    }
}