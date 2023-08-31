using Domain.FlagDrafts;

namespace Infrastructure.FlagDrafts;

public class FlagDraftService : MongoDbService<FlagDraft>, IFlagDraftService
{
    public FlagDraftService(MongoDbClient mongoDb) : base(mongoDb)
    {
    }
}