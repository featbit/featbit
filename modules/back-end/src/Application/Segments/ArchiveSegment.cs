namespace Application.Segments;

public class ArchiveSegment : IRequest<bool>
{
    public Guid Id { get; set; }
}

public class ArchiveSegmentHandler : IRequestHandler<ArchiveSegment, bool>
{
    private readonly ISegmentService _service;

    public ArchiveSegmentHandler(ISegmentService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(ArchiveSegment request, CancellationToken cancellationToken)
    {
        var segment = await _service.GetAsync(request.Id);
        segment.Archive();

        await _service.UpdateAsync(segment);

        return true;
    }
}