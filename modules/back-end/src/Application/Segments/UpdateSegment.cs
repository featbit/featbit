using Application.Bases;
using Application.Users;
using Domain.AuditLogs;
using Domain.Segments;
using Domain.Targeting;

namespace Application.Segments;

public class UpdateSegment : IRequest<Segment>
{
    public Guid Id { get; set; }

    public string Name { get; set; }

    public string Description { get; set; }

    public ICollection<string> Included { get; set; } = Array.Empty<string>();

    public ICollection<string> Excluded { get; set; } = Array.Empty<string>();

    public ICollection<MatchRule> Rules { get; set; } = Array.Empty<MatchRule>();
    
    public string Comment { get; set; }
}

public class UpdateSegmentValidator : AbstractValidator<UpdateSegment>
{
    public UpdateSegmentValidator()
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
        var flagReferences = await _service.GetFlagReferencesAsync(segment.EnvId, segment.Id);
        var notification = new OnSegmentChange(
            segment, flagReferences.Select(x => x.Id), Operations.Update, dataChange, _currentUser.Id, request.Comment
        );
        await _publisher.Publish(notification, cancellationToken);

        return segment;
    }
}