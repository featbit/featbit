using Application.Bases;
using Application.Users;
using Domain.AuditLogs;
using Domain.Targeting;

namespace Application.Segments;

public class UpdateTargeting : IRequest<bool>
{
    public Guid Id { get; set; }

    public string[] Included { get; set; } = [];

    public string[] Excluded { get; set; } = [];

    public ICollection<MatchRule> Rules { get; set; } = Array.Empty<MatchRule>();

    public string Comment { get; set; }
}

public class UpdateTargetingValidator : AbstractValidator<UpdateTargeting>
{
    public UpdateTargetingValidator()
    {
        RuleFor(x => x.Rules)
            .Must(rules =>
            {
                var conditions = rules.SelectMany(x => x.Conditions);
                return conditions.All(x => !x.IsSegmentCondition());
            }).WithErrorCode(ErrorCodes.Invalid("rules"));
    }
}

public class UpdateTargetingHandler(
    ISegmentService service,
    ICurrentUser currentUser,
    IPublisher publisher
) : IRequestHandler<UpdateTargeting, bool>
{
    public async Task<bool> Handle(UpdateTargeting request, CancellationToken cancellationToken)
    {
        var segment = await service.GetAsync(request.Id);
        var dataChange = segment.UpdateTargeting(request.Included, request.Excluded, request.Rules);
        await service.UpdateAsync(segment);

        // publish on segment change notification
        var notification = new OnSegmentChange(
            segment,
            Operations.Update,
            dataChange,
            currentUser.Id,
            comment: request.Comment,
            isTargetingChange: true
        );
        await publisher.Publish(notification, cancellationToken);

        return true;
    }
}