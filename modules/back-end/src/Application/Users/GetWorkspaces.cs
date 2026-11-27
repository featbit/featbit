using Application.Workspaces;

namespace Application.Users;

public class GetWorkspaces : IRequest<ICollection<WorkspaceVm>>
{
    public Guid UserId { get; set; }
}

public class GetWorkspacesHandler(IUserService service)
    : IRequestHandler<GetWorkspaces, ICollection<WorkspaceVm>>
{
    public async ValueTask<ICollection<WorkspaceVm>> Handle(GetWorkspaces request, CancellationToken cancellationToken)
    {
        var workspace = await service.GetWorkspacesAsync(request.UserId);
        return WorkspaceMapper.ToVm(workspace);
    }
}