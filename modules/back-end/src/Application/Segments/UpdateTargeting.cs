using Application.Bases;
using Application.Users;
using Domain.AuditLogs;
using Domain.Targeting;

namespace Application.Segments;

public class UpdateTargeting : IRequest<bool>
{
    /// <summary>
    /// The ID of the segment to update. Retrieved from the URL path.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// The list of user keys explicitly included in the segment
    /// </summary>
    public string[] Included { get; set; } = [];

    /// <summary>
    /// The list of user keys explicitly excluded from the segment
    /// </summary>
    public string[] Excluded { get; set; } = [];

    /// <summary>
    /// The collection of match rules for targeting users in the segment
    /// </summary>
    public ICollection<MatchRule> Rules { get; set; } = [];

    /// <summary>
    /// Optional comment describing the targeting change
    /// </summary>
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