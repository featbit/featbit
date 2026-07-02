using Domain.FlagChangeRequests;
using Domain.FlagSchedules;
using MongoDB.Driver;

namespace Infrastructure.Services.MongoDb;

public class FlagScheduleService(MongoDbClient mongoDb) : MongoDbService<FlagSchedule>(mongoDb), IFlagScheduleService
{
    public async Task DeleteAsync(Guid id)
    {
        await Collection.DeleteOneAsync(x => x.Id == id);

        // delete related flag change requests
        await MongoDb.CollectionOf<FlagChangeRequest>().DeleteOneAsync(x => x.ScheduleId == id);
    }
}