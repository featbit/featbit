using System.Linq.Expressions;
using Application.Bases.Models;
using Application.EndUsers;
using Domain.EndUsers;

namespace Application.Services;

public interface IEndUserService
{
    Task<EndUser> GetAsync(Guid id);

    Task<PagedResult<EndUser>> GetListAsync(Guid envId, EndUserFilter filter);

    Task<ICollection<EndUser>> FindManyAsync(Expression<Func<EndUser, bool>> filter);

    Task<EndUser> UpsertAsync(EndUser user);

    Task<IEnumerable<EndUserProperty>> GetPropertiesAsync(Guid envId);

    Task<EndUserProperty> UpsertPropertyAsync(EndUserProperty property);

    Task DeletePropertyAsync(Guid propertyId);
}