using Domain.RefreshTokens;

namespace Application.Services;

public interface IRefreshTokenService : IService<RefreshToken>
{
    Task<(string, string)> CreateAsync(Guid userId, string ipAddress);
    
    Task<RefreshToken> GetByTokenAsync(string token);
}