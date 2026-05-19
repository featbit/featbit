using Application.Workspaces;

namespace Application.Users;

public class GetCurrentWorkspace : IRequest<WorkspaceVm>
{
    public Guid UserId { get; set; }

    public Guid WorkspaceId { get; set; }
}

public class GetCurrentWorkspaceHandler(IUserService service, IMapper mapper)
    : IRequestHandler<GetCurrentWorkspace, WorkspaceVm>
{
    public async Task<WorkspaceVm> Handle(GetCurrentWorkspace request, CancellationToken cancellationToken)
    {
        var workspace = await service.GetWorkspaceAsync(request.UserId, request.WorkspaceId);
        return mapper.Map<WorkspaceVm>(workspace);
    }
}