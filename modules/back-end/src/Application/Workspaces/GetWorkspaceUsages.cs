namespace Application.Workspaces;

public class GetWorkspaceUsages : IRequest<object>
{
    public Guid WorkspaceId { get; set; }

    public DateOnly StartDate { get; set; }

    public DateOnly EndDate { get; set; }

    public DateOnly PrevStartDate { get; set; }

    public DateOnly PrevEndDate { get; set; }
}

public class GetWorkspaceUsagesHandler(IWorkspaceService service) : IRequestHandler<GetWorkspaceUsages, object>
{
    public async Task<object> Handle(GetWorkspaceUsages request, CancellationToken cancellationToken)
    {
        // TODO
        return new { };
    }
}