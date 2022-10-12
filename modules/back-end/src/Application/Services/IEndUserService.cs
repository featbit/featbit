using Application.Bases.Models;
using Application.EndUsers;
using Domain.EndUsers;

namespace Application.Services;

public interface IEndUserService : IService<EndUser>
{
    Task<PagedResult<EndUser>> GetListAsync(Guid envId, EndUserFilter filter);

    Task<EndUser> UpsertAsync(EndUser user);

    Task<IEnumerable<EndUserProperty>> GetPropertiesAsync(Guid envId);

    Task<EndUserProperty> UpsertPropertyAsync(EndUserProperty property);

    Task DeletePropertyAsync(Guid propertyId);
}