using Domain.FlagSchedules;

namespace Infrastructure.FlagSchedules;

public class FlagScheduleService : MongoDbService<FlagSchedule>, IFlagScheduleService
{
    public FlagScheduleService(MongoDbClient mongoDb) : base(mongoDb)
    {
    }
}