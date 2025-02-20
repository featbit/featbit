using Application.Bases.Models;
using Application.GlobalUsers;
using Domain.EndUsers;

namespace Application.Services;

public interface IGlobalUserService : IService<EndUser>
{
    Task<PagedResult<EndUser>> GetListAsync(Guid workspaceId, GlobalUserFilter filter);
}