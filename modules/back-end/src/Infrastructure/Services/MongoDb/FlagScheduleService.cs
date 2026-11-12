using Domain.FlagChangeRequests;
using Domain.FlagSchedules;
using MongoDB.Driver;

namespace Infrastructure.Services.MongoDb;

public class FlagScheduleService(MongoDbClient mongoDb) : MongoDbService<FlagSchedule>(mongoDb), IFlagScheduleService
{
    public async Task<bool> TrySetReviewOutcomeAsync(Guid id, Guid changeRequestId, bool approved, Guid operatorId)
    {
        var filter = Builders<FlagSchedule>.Filter.Where(x => x.Id == id && x.ChangeRequestId == changeRequestId &&
            (x.Status == FlagScheduleStatus.PendingReview || (!approved && x.Status == FlagScheduleStatus.PendingExecution)));
        var update = Builders<FlagSchedule>.Update
            .Set(x => x.Status, approved ? FlagScheduleStatus.PendingExecution : FlagScheduleStatus.Declined)
            .Set(x => x.UpdatedAt, DateTime.UtcNow).Set(x => x.UpdatorId, operatorId);
        return (await Collection.UpdateOneAsync(filter, update)).MatchedCount == 1;
    }

    public async Task<bool> TryMarkAppliedAsync(Guid id, Guid operatorId)
    {
        var filter = Builders<FlagSchedule>.Filter.Where(x => x.Id == id && x.Status == FlagScheduleStatus.PendingExecution);
        var update = Builders<FlagSchedule>.Update.Set(x => x.Status, FlagScheduleStatus.Applied)
            .Set(x => x.UpdatedAt, DateTime.UtcNow).Set(x => x.UpdatorId, operatorId);
        return (await Collection.UpdateOneAsync(filter, update)).MatchedCount == 1;
    }

    public async Task DeleteAsync(Guid id)
    {
        await Collection.DeleteOneAsync(x => x.Id == id);

        // delete related flag change requests
        await MongoDb.CollectionOf<FlagChangeRequest>().DeleteOneAsync(x => x.ScheduleId == id);
    }
}
