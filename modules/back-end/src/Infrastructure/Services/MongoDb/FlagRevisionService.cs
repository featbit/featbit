using Domain.FlagRevisions;

namespace Infrastructure.Services.MongoDb;

public class FlagRevisionService : MongoDbService<FlagRevision>, IFlagRevisionService
{
    public FlagRevisionService(MongoDbClient mongoDb) : base(mongoDb)
    {
    }
}