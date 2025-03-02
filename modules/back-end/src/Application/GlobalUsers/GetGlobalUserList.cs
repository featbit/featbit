using Application.Bases.Models;
using Domain.EndUsers;

namespace Application.GlobalUsers;

public class GetGlobalUserList : IRequest<PagedResult<GlobalUser>>
{
    public Guid WorkspaceId { get; set; }

    public GlobalUserFilter Filter { get; set; }
}

public class GetGlobalUserListHandler(IGlobalUserService service, IMapper mapper)
    : IRequestHandler<GetGlobalUserList, PagedResult<GlobalUser>>
{
    public async Task<PagedResult<GlobalUser>> Handle(GetGlobalUserList request, CancellationToken cancellationToken)
    {
        var endUsers = await service.GetListAsync(request.WorkspaceId, request.Filter);

        return mapper.Map<PagedResult<GlobalUser>>(endUsers);
    }
}