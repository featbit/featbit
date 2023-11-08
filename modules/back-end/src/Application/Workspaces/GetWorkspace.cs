namespace Application.Workspaces;

public class GetWorkspace : IRequest<WorkspaceVm>
{
    public Guid Id { get; set; }
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
        var workspace = await _service.GetAsync(request.Id);
        return _mapper.Map<WorkspaceVm>(workspace);
    }
}

