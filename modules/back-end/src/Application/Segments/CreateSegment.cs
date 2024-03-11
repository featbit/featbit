using Application.Bases;
using Application.Users;
using Domain.AuditLogs;
using Domain.Segments;
using Domain.Targeting;

namespace Application.Segments;

public class CreateSegment : IRequest<Segment>
{
    public Guid EnvId { get; set; }

    public string Name { get; set; }

    public string Description { get; set; }

    public ICollection<string> Included { get; set; } = Array.Empty<string>();

    public ICollection<string> Excluded { get; set; } = Array.Empty<string>();

    public ICollection<MatchRule> Rules { get; set; } = Array.Empty<MatchRule>();

    public Segment AsSegment()
    {
        return new Segment(EnvId, Name, Included, Excluded, Rules, Description);
    }
}

public class CreateSegmentValidator : AbstractValidator<CreateSegment>
{
    public CreateSegmentValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.NameIsRequired);

        RuleFor(x => x.Rules)
            .Must(rules =>
            {
                var conditions = rules.SelectMany(x => x.Conditions);
                return conditions.All(x => !x.IsSegmentCondition());
            }).WithErrorCode(ErrorCodes.SegmentCannotReferenceSegmentCondition);
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