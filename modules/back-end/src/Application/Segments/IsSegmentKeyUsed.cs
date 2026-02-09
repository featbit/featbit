namespace Application.Segments;

public class IsSegmentKeyUsed : IRequest<bool>
{
    public Guid WorkspaceId { get; set; }

    public string Type { get; set; }

    public Guid EnvId { get; set; }

    public string Key { get; set; }
}

public class IsSegmentKeyUsedHandler(ISegmentService service) : IRequestHandler<IsSegmentKeyUsed, bool>
{
    public async Task<bool> Handle(IsSegmentKeyUsed request, CancellationToken cancellationToken) =>
        await service.IsKeyUsedAsync(request.WorkspaceId, request.Type, request.EnvId, request.Key);
}