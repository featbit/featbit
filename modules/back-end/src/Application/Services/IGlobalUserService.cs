using Application.Bases.Models;
using Application.GlobalUsers;
using Domain.EndUsers;

namespace Application.Services;

public interface IGlobalUserService : IService<GlobalUser>
{
    Task<PagedResult<GlobalUser>> GetListAsync(GlobalUserFilter filter);
}