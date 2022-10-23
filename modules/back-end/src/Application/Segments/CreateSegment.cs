using Application.Bases;
using Domain.Segments;
using Domain.Targeting;

namespace Application.Segments;

public class CreateSegment : IRequest<Segment>
{
    public Guid EnvId { get; set; }

    public string Name { get; set; }

    public string Description { get; set; }

    public IEnumerable<string> Included { get; set; } = Array.Empty<string>();

    public IEnumerable<string> Excluded { get; set; } = Array.Empty<string>();

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

    public CreateSegmentHandler(ISegmentService service, IPublisher publisher)
    {
        _service = service;
        _publisher = publisher;
    }

    public async Task<Segment> Handle(CreateSegment request, CancellationToken cancellationToken)
    {
        var segment = request.AsSegment();
        await _service.AddOneAsync(segment);

        // publish on segment created message
        await _publisher.Publish(new OnSegmentChange(segment), cancellationToken);

        return segment;
    }
}