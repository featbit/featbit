using Domain.FlagRevisions;

namespace Infrastructure.FlagRevisions;

public class FlagRevisionService : MongoDbService<FlagRevision>, IFlagRevisionService
{
    public FlagRevisionService(MongoDbClient mongoDb) : base(mongoDb)
    {
    }
}