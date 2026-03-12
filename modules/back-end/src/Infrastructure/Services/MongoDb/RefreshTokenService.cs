using Domain.RefreshTokens;

namespace Infrastructure.Services.MongoDb;

public class RefreshTokenService(MongoDbClient mongoDb) : MongoDbService<RefreshToken>(mongoDb), IRefreshTokenService;