namespace Application.Segments;

public class IsSegmentNameUsed : IRequest<bool>
{
    public Guid WorkspaceId { get; set; }

    public string Type { get; set; }

    public Guid EnvId { get; set; }

    public string Name { get; set; }
}

public class IsSegmentNameUsedHandler(ISegmentService service) : IRequestHandler<IsSegmentNameUsed, bool>
{
    public async Task<bool> Handle(IsSegmentNameUsed request, CancellationToken cancellationToken) =>
        await service.IsNameUsedAsync(request.WorkspaceId, request.Type, request.EnvId, request.Name);
}