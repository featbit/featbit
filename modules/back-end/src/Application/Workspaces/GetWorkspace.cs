using Domain.Policies;
using Domain.Resources;

namespace Application.Workspaces;

public class GetWorkspace : IRequest<WorkspaceVm>
{
    public Guid Id { get; set; }

    /// <summary>
    /// Current request permissions
    /// </summary>
    public PolicyStatement[] Permissions { get; set; }
}

public class GetWorkspaceHandler(IWorkspaceService service, IMapper mapper) : IRequestHandler<GetWorkspace, WorkspaceVm>
{
    public async Task<WorkspaceVm> Handle(GetWorkspace request, CancellationToken cancellationToken)
    {
        var permissions = request.Permissions;
        var workspace = await service.GetAsync(request.Id);

        var canUpdateSso =
            PolicyHelper.IsAllowed(permissions, RN.ForWorkspace(), Permissions.UpdateWorkspaceSSOSettings);
        if (!canUpdateSso)
        {
            workspace.Sso = null;
        }

        var canUpdateLicense =
            PolicyHelper.IsAllowed(permissions, RN.ForWorkspace(), Permissions.UpdateWorkspaceLicense);
        if (!canUpdateLicense)
        {
            workspace.License = null;
        }

        return mapper.Map<WorkspaceVm>(workspace);
    }
}