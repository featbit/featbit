using Domain.RefreshTokens;

namespace Infrastructure.Services.MongoDb;

public class RefreshTokenService(MongoDbClient mongoDb, ITokenHashService tokenHashService) : MongoDbService<RefreshToken>(mongoDb), IRefreshTokenService
{
    public async Task<(string, string)> CreateAsync(Guid userId, string ipAddress)
    {
        var refreshTokenValue = tokenHashService.GenerateToken();
        var hashedRefreshToken = tokenHashService.HashToken(refreshTokenValue);
        var newRefreshToken = new RefreshToken(
            hashedRefreshToken,
            userId,
            DateTime.UtcNow.AddDays(30),
            ipAddress
        );
        
        await AddOneAsync(newRefreshToken);

        return (refreshTokenValue, hashedRefreshToken);
    }

    public async Task<RefreshToken> GetByTokenAsync(string token)
    {
        return await FindOneAsync(x => x.Token == token);
    }
}