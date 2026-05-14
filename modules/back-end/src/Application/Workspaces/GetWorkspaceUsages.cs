namespace Application.Workspaces;

public class GetWorkspaceUsages : IRequest<WorkspaceUsageVm>
{
    public Guid WorkspaceId { get; set; }

    public WorkspaceUsageFilter Filter { get; set; }
}

public class GetWorkspaceUsagesHandler(IWorkspaceService service)
    : IRequestHandler<GetWorkspaceUsages, WorkspaceUsageVm>
{
    public async Task<WorkspaceUsageVm> Handle(GetWorkspaceUsages request, CancellationToken cancellationToken)
        => await service.GetUsageAsync(request.WorkspaceId, request.Filter);
}