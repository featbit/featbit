namespace Application.Segments;

public class IsSegmentNameUsed : IRequest<bool>
{
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
        return await _service.AnyAsync(x => !x.IsArchived && x.EnvId == request.EnvId && string.Equals(x.Name, request.Name, StringComparison.OrdinalIgnoreCase));
    }
}