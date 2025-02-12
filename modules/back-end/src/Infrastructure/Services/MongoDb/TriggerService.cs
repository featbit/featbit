using Domain.Triggers;

namespace Infrastructure.Services.MongoDb;

public class TriggerService(MongoDbClient mongoDb) : MongoDbService<Trigger>(mongoDb), ITriggerService;