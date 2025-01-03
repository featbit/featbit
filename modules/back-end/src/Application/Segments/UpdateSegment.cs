using Application.Users;
using Domain.AuditLogs;
using Domain.Segments;

namespace Application.Segments;

public class UpdateSegment : SegmentBase, IRequest<Segment>
{
    public Guid Id { get; set; }

    public string Comment { get; set; }
}

public class UpdateSegmentValidator : AbstractValidator<UpdateSegment>
{
    public UpdateSegmentValidator()
    {
        Include(new SegmentBaseValidator());
    }
}

public class UpdateSegmentHandler : IRequestHandler<UpdateSegment, Segment>
{
    private readonly ISegmentService _service;
    private readonly IPublisher _publisher;
    private readonly ICurrentUser _currentUser;

    public UpdateSegmentHandler(
        ISegmentService service,
        IPublisher publisher,
        ICurrentUser currentUser)
    {
        _service = service;
        _publisher = publisher;
        _currentUser = currentUser;
    }

    public async Task<Segment> Handle(UpdateSegment request, CancellationToken cancellationToken)
    {
        var segment = await _service.GetAsync(request.Id);
        var dataChange = segment.Update(request.Name, request.Included, request.Excluded, request.Rules, request.Description);
        await _service.UpdateAsync(segment);

        // publish segment updated notification
        var notification = new OnSegmentChange(segment, Operations.Update, dataChange, _currentUser.Id, request.Comment);
        await _publisher.Publish(notification, cancellationToken);

        return segment;
    }
}