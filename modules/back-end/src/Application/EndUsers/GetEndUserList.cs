using Application.Bases.Models;
using Domain.EndUsers;

namespace Application.EndUsers;

public class GetEndUserList : IRequest<PagedResult<EndUser>>
{
    public Guid WorkspaceId { get; set; }

    public Guid EnvId { get; set; }

    public EndUserFilter Filter { get; set; }
}

public class GetEndUserListHandler(IEndUserService service) : IRequestHandler<GetEndUserList, PagedResult<EndUser>>
{
    public async Task<PagedResult<EndUser>> Handle(GetEndUserList request, CancellationToken cancellationToken) =>
        await service.GetListAsync(request.WorkspaceId, request.EnvId, request.Filter);
}