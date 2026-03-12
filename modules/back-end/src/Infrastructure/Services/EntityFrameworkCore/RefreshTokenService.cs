using Domain.RefreshTokens;

namespace Infrastructure.Services.EntityFrameworkCore;

public class RefreshTokenService(AppDbContext dbContext, ITokenHashService tokenHashService) : EntityFrameworkCoreService<RefreshToken>(dbContext), IRefreshTokenService
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
}