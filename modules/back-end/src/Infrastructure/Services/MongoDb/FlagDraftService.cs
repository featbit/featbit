using Domain.FlagDrafts;

namespace Infrastructure.Services.MongoDb;

public class FlagDraftService : MongoDbService<FlagDraft>, IFlagDraftService
{
    public FlagDraftService(MongoDbClient mongoDb) : base(mongoDb)
    {
    }
}