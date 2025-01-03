using Domain.Segments;

namespace Application.Segments;

public class IsSegmentNameUsed : IRequest<bool>
{
    public Guid WorkspaceId { get; set; }

    public string Type { get; set; }

    public Guid EnvId { get; set; }

    public string Name { get; set; }
}

public class IsSegmentNameUsedHandler : IRequestHandler<IsSegmentNameUsed, bool>
{
    private readonly ISegmentService _service;

    public IsSegmentNameUsedHandler(ISegmentService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(IsSegmentNameUsed request, CancellationToken cancellationToken)
    {
        if (request.Type == SegmentType.EnvironmentSpecific)
        {
            return await _service.AnyAsync(x =>
                x.EnvId == request.EnvId &&
                x.Type == SegmentType.EnvironmentSpecific &&
                string.Equals(x.Name, request.Name, StringComparison.OrdinalIgnoreCase)
            );
        }

        return await _service.AnyAsync(x =>
            x.WorkspaceId == request.WorkspaceId &&
            x.Type == SegmentType.Shared &&
            string.Equals(x.Name, request.Name, StringComparison.OrdinalIgnoreCase)
        );
    }
}