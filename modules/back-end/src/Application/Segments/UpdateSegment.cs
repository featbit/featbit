using Application.Bases;
using Domain.FeatureFlags;
using Domain.Segments;

namespace Application.Segments;

public class UpdateSegment : IRequest<Segment>
{
    public Guid Id { get; set; }

    public string Name { get; set; }

    public string Description { get; set; }

    public IEnumerable<string> Included { get; set; } = Array.Empty<string>();

    public IEnumerable<string> Excluded { get; set; } = Array.Empty<string>();

    public ICollection<TargetRule> Rules { get; set; } = Array.Empty<TargetRule>();
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

    public UpdateSegmentHandler(ISegmentService service)
    {
        _service = service;
    }

    public async Task<Segment> Handle(UpdateSegment request, CancellationToken cancellationToken)
    {
        var segment = await _service.GetAsync(request.Id);

        segment.Update(request.Name, request.Included, request.Excluded, request.Rules, request.Description);

        await _service.UpdateAsync(segment);

        return segment;
    }
}