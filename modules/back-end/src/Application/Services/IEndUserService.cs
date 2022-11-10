using Application.Bases.Models;
using Application.EndUsers;
using Domain.EndUsers;

namespace Application.Services;

public interface IEndUserService : IService<EndUser>
{
    Task<IEnumerable<EndUser>> GetListByKeyIdsAsync(Guid envId, IEnumerable<string> keyIds);
    Task<PagedResult<EndUser>> GetListAsync(Guid envId, EndUserFilter filter);

    Task<EndUser> UpsertAsync(EndUser user);

    Task AddBuiltInPropertiesAsync(Guid envId);

    Task<IEnumerable<EndUserProperty>> AddNewPropertiesAsync(EndUser user);

    Task<IEnumerable<EndUserProperty>> GetPropertiesAsync(Guid envId);

    Task<EndUserProperty> UpsertPropertyAsync(EndUserProperty property);

    Task DeletePropertyAsync(Guid propertyId);
}