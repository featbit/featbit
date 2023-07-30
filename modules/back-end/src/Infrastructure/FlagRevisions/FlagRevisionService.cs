using Domain.FeatureFlags;
using Domain.FlagRevisions;
using MongoDB.Driver;

namespace Infrastructure.FlagRevisions;

public class FlagRevisionService : MongoDbService<FlagRevision>, IFlagRevisionService
{
    public FlagRevisionService(MongoDbClient mongoDb) : base(mongoDb)
    {
    }

    public async Task<FlagRevision> CreateForFlag(FeatureFlag flag, string comment, Guid currentUserId)
    {
        var flagRevision = FlagRevision.FromFlag(flag, comment, currentUserId);
        flagRevision.Version = await GetNextVersionForFlag(flag.Id);
        await AddOneAsync(flagRevision);

        return flagRevision;
    }

    private async Task<int> GetNextVersionForFlag(Guid flagId)
    {
        var filter = Builders<FlagRevision>
            .Filter
            .Eq(revision => revision.FlagId, flagId);

        var flagRevision = await Collection
            .Find(filter)
            .SortByDescending(flag => flag.Version)
            .FirstOrDefaultAsync();
        
        return flagRevision != null ? flagRevision.Version + 1 : 1;
    }
}