using Domain.FlagChangeRequests;

namespace Infrastructure.Services.MongoDb;

public class FlagChangeRequestService(MongoDbClient mongoDb)
    : MongoDbService<FlagChangeRequest>(mongoDb), IFlagChangeRequestService;