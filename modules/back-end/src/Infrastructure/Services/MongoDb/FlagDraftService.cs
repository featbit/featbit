using Domain.FlagDrafts;

namespace Infrastructure.Services.MongoDb;

public class FlagDraftService(MongoDbClient mongoDb) : MongoDbService<FlagDraft>(mongoDb), IFlagDraftService;