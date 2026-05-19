using Domain.Policies;
using Domain.Resources;

namespace Application.Workspaces;

public class GetWorkspace : IRequest<WorkspaceVm>
{
    public Guid Id { get; set; }

    public bool IsOpenApiRequest { get; set; }

    /// <summary>
    /// Current request permissions
    /// </summary>
    public PolicyStatement[] Permissions { get; set; }
}

public class GetWorkspaceHandler : IRequestHandler<GetWorkspace, WorkspaceVm>
{
    private readonly IWorkspaceService _service;
    private readonly IMapper _mapper;

    public GetWorkspaceHandler(IWorkspaceService service, IMapper mapper)
    {
        _service = service;
        _mapper = mapper;
    }
    
    public async Task<WorkspaceVm> Handle(GetWorkspace request, CancellationToken cancellationToken)
    {
        var permissions = request.Permissions;
        
        var workspace = await _service.GetAsync(request.Id);
        
        var canUpdatesoSettings = PolicyHelper.IsAllowed(permissions, RN.ForWorkspace(), Permissions.UpdateWorkspaceSSOSettings);
        if (!canUpdatesoSettings)
        {
            workspace.Sso = null;
        }
        
        var canUpdateLicense = PolicyHelper.IsAllowed(permissions, RN.ForWorkspace(), Permissions.UpdateWorkspaceLicense);
        if (!canUpdateLicense)
        {
            workspace.License = null;
        }

        return _mapper.Map<WorkspaceVm>(workspace);
    }
}

