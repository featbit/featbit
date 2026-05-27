using Application.Workspaces;

namespace Application.Users;

public class GetWorkspaces : IRequest<IEnumerable<WorkspaceVm>>
{
    public Guid UserId { get; set; }
}

public class GetWorkspacesHandler(IUserService service, IMapper mapper)
    : IRequestHandler<GetWorkspaces, IEnumerable<WorkspaceVm>>
{
    public async Task<IEnumerable<WorkspaceVm>> Handle(GetWorkspaces request, CancellationToken cancellationToken)
    {
        var workspace = await service.GetWorkspacesAsync(request.UserId);
        return mapper.Map<IEnumerable<WorkspaceVm>>(workspace);
    }
}