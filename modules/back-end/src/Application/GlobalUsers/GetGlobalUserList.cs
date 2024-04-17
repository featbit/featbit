using Application.Bases.Models;
using Domain.EndUsers;

namespace Application.GlobalUsers;

public class GetGlobalUserList : IRequest<PagedResult<GlobalUser>>
{
    public Guid WorkspaceId { get; set; }

    public GlobalUserFilter Filter { get; set; }
}

public class GetGlobalUserListHandler : IRequestHandler<GetGlobalUserList, PagedResult<GlobalUser>>
{
    private readonly IGlobalUserService _service;

    public GetGlobalUserListHandler(IGlobalUserService service)
    {
        _service = service;
    }

    public async Task<PagedResult<GlobalUser>> Handle(GetGlobalUserList request, CancellationToken cancellationToken)
    {
        return await _service.GetListAsync(request.WorkspaceId, request.Filter);
    }
}