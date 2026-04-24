using Application.Bases;
using Application.Bases.Exceptions;
using Application.Users;
using Domain.AuditLogs;
using Domain.Policies;
using Domain.SemanticPatch;
using Domain.Targeting;

namespace Application.Segments;

public class UpdateTargetingPayload
{
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

public class UpdateTargeting : UpdateTargetingPayload, IRequest<bool>
{
    public Guid Id { get; set; }

    public PolicyStatement[] Permissions { get; set; }

    public UpdateTargeting(Guid segmentId, UpdateTargetingPayload payload, PolicyStatement[] permissions)
    {
        Id = segmentId;
        Included = payload.Included;
        Excluded = payload.Excluded;
        Rules = payload.Rules;
        Comment = payload.Comment;
        Permissions = permissions;
    }
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
    IResourceService resourceService,
    ICurrentUser currentUser,
    IPublisher publisher
) : IRequestHandler<UpdateTargeting, bool>
{
    public async Task<bool> Handle(UpdateTargeting request, CancellationToken cancellationToken)
    {
        var segment = await service.GetAsync(request.Id);
        var dataChange = segment.UpdateTargeting(request.Included, request.Excluded, request.Rules);

        await CheckPermissionsAsync();

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

        async Task CheckPermissionsAsync()
        {
            var instructions = SegmentComparer.Compare(dataChange).ToArray();
            List<string> requiredPermissions = [];

            if (instructions.Any(x => SegmentInstructionKind.UpdateRuleKinds.Contains(x.Kind)))
            {
                requiredPermissions.Add(Permissions.UpdateSegmentRules);
            }

            if (instructions.Any(x => SegmentInstructionKind.UpdateTargetUsersKinds.Contains(x.Kind)))
            {
                requiredPermissions.Add(Permissions.UpdateSegmentTargetingUsers);
            }

            if (requiredPermissions.Count == 0)
            {
                return;
            }

            var segmentRN = await resourceService.GetSegmentRnAsync(segment.EnvId, segment.Id);
            if (requiredPermissions.Any(permission => !PolicyHelper.IsAllowed(request.Permissions, segmentRN, permission)))
            {
                throw new ForbiddenException();
            }
        }
    }
}