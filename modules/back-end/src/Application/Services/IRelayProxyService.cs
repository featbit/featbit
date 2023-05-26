using Application.Bases.Models;
using Application.RelayProxies;
using Domain.RelayProxies;

namespace Application.Services;

public interface IRelayProxyService : IService<RelayProxy>
{
    Task<PagedResult<RelayProxy>> GetListAsync(Guid organizationId, RelayProxyFilter filter);
    
    Task DeleteAsync(Guid id);
}