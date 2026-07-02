using Domain.FlagRevisions;

namespace Infrastructure.Services.MongoDb;

public class FlagRevisionService(MongoDbClient mongoDb) : MongoDbService<FlagRevision>(mongoDb), IFlagRevisionService;