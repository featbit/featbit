using Application.Bases.Models;
using Domain.EndUsers;

namespace Application.EndUsers;

public class GetEndUserList : IRequest<CursorPagedResult<EndUser>>
{
    public Guid EnvId { get; set; }

    public EndUserFilter Filter { get; set; }
}

public class GetEndUserListHandler(IEndUserService service)
    : IRequestHandler<GetEndUserList, CursorPagedResult<EndUser>>
{
    public async Task<CursorPagedResult<EndUser>> Handle(GetEndUserList request, CancellationToken cancellationToken) =>
        await service.GetListAsync(request.EnvId, request.Filter);
}