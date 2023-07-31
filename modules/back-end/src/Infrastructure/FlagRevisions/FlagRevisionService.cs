using Domain.FeatureFlags;
using Domain.FlagRevisions;

namespace Infrastructure.FlagRevisions;

public class FlagRevisionService : MongoDbService<FlagRevision>, IFlagRevisionService
{
    public FlagRevisionService(MongoDbClient mongoDb) : base(mongoDb)
    {
    }

    public async Task<FlagRevision> CreateForFlag(FeatureFlag flag, string comment, Guid currentUserId)
    {
        var flagRevision = FlagRevision.FromFlag(flag, comment, currentUserId);
        await AddOneAsync(flagRevision);
        
        return flagRevision;
    }
}