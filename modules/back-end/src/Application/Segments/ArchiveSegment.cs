namespace Application.Segments;

public class ArchiveSegment : IRequest<bool>
{
    public Guid Id { get; set; }
}

public class ArchiveSegmentHandler : IRequestHandler<ArchiveSegment, bool>
{
    private readonly ISegmentService _service;
    private readonly IPublisher _publisher;

    public ArchiveSegmentHandler(ISegmentService service, IPublisher publisher)
    {
        _service = service;
        _publisher = publisher;
    }

    public async Task<bool> Handle(ArchiveSegment request, CancellationToken cancellationToken)
    {
        var segment = await _service.GetAsync(request.Id);
        segment.Archive();
        await _service.UpdateAsync(segment);

        // publish on segment archived notification
        await _publisher.Publish(new OnSegmentChange(segment), cancellationToken);

        return true;
    }
}