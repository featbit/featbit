using Application.Bases;
using Application.Users;
using Domain.AuditLogs;
using Domain.Segments;

namespace Application.Segments;

public class CreateSegment : SegmentBase, IRequest<Segment>
{
    public Guid EnvId { get; set; }

    public string Type { get; set; }

    public Segment AsSegment()
    {
        return new Segment(EnvId, Name, Type, Scopes, Included, Excluded, Rules, Description);
    }
}

public class CreateSegmentValidator : AbstractValidator<CreateSegment>
{
    public CreateSegmentValidator()
    {
        Include(new SegmentBaseValidator());

        RuleFor(x => x.Type)
            .Must(SegmentType.IsDefined).WithErrorCode(ErrorCodes.Invalid("type"));
    }
}

public class CreateSegmentHandler : IRequestHandler<CreateSegment, Segment>
{
    private readonly ISegmentService _service;
    private readonly IPublisher _publisher;
    private readonly ICurrentUser _currentUser;

    public CreateSegmentHandler(
        ISegmentService service,
        IPublisher publisher,
        ICurrentUser currentUser)
    {
        _service = service;
        _publisher = publisher;
        _currentUser = currentUser;
    }

    public async Task<Segment> Handle(CreateSegment request, CancellationToken cancellationToken)
    {
        var segment = request.AsSegment();
        await _service.AddOneAsync(segment);

        // publish on segment created notification
        var dataChange = new DataChange(null).To(segment);
        var notification = new OnSegmentChange(segment, Operations.Create, dataChange, _currentUser.Id);
        await _publisher.Publish(notification, cancellationToken);

        return segment;
    }
}