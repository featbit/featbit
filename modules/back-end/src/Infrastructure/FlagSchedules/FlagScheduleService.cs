using Domain.FlagChangeRequests;
using Domain.FlagSchedules;
using MongoDB.Driver;

namespace Infrastructure.FlagSchedules;

public class FlagScheduleService : MongoDbService<FlagSchedule>, IFlagScheduleService
{
    public FlagScheduleService(MongoDbClient mongoDb) : base(mongoDb)
    {
    }

    public async Task DeleteAsync(Guid id)
    {
        await Collection.DeleteOneAsync(x => x.Id == id);

        // delete related flag change requests
        await MongoDb.CollectionOf<FlagChangeRequest>().DeleteOneAsync(x => x.ScheduleId == id);
    }
}