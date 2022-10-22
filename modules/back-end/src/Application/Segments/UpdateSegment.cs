using Application.Bases;
using Domain.Segments;
using Domain.Targeting;

namespace Application.Segments;

public class UpdateSegment : IRequest<Segment>
{
    public Guid Id { get; set; }

    public string Name { get; set; }

    public string Description { get; set; }

    public IEnumerable<string> Included { get; set; } = Array.Empty<string>();

    public IEnumerable<string> Excluded { get; set; } = Array.Empty<string>();

    public ICollection<MatchRule> Rules { get; set; } = Array.Empty<MatchRule>();
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

    public UpdateSegmentHandler(ISegmentService service, IPublisher publisher)
    {
        _service = service;
        _publisher = publisher;
    }

    public async Task<Segment> Handle(UpdateSegment request, CancellationToken cancellationToken)
    {
        var segment = await _service.GetAsync(request.Id);
        segment.Update(request.Name, request.Included, request.Excluded, request.Rules, request.Description);
        await _service.UpdateAsync(segment);

        // publish segment updated notification
        var flagReferences = await _service.GetFlagReferencesAsync(segment.EnvId, segment.Id);
        await _publisher.Publish(new OnSegmentChange(segment, flagReferences.Select(x => x.Id)), cancellationToken);

        return segment;
    }
}