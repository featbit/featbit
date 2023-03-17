using Application.AccessTokens;
using Application.Bases.Models;
using Domain.AccessTokens;

namespace Application.Services;

public interface IAccessTokenService : IService<AccessToken>
{
    Task<PagedResult<AccessToken>> GetListAsync(Guid organizationId, AccessTokenFilter filter);

    Task DeleteAsync(Guid id);
}