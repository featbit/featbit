using System.ComponentModel.DataAnnotations;
using Application.Bases;
using Application.Bases.Exceptions;
using Application.Users;
using Domain.AuditLogs;
using Domain.Segments;
using Domain.Workspaces;

namespace Application.Segments;

public class CreateSegmentPayload
{
    /// <summary>
    /// The type of the segment. Can be "environment-specific" or "shared".
    /// </summary>
    public string Type { get; set; }

    /// <summary>
    /// The name of the segment.
    /// </summary>
    public string Name { get; set; }

    /// <summary>
    /// The unique key of the segment.
    /// </summary>
    public string Key { get; set; }

    /// <summary>
    /// The description of the segment.
    /// </summary>
    public string Description { get; set; }

    /// <summary>
    /// The scopes where the segment is applicable. Required, with at least one scope. Scopes use keys, not IDs.
    /// For an <c>environment-specific</c> segment, provide exactly one scope: the current environment's scope,
    /// <c>organization/{orgKey}:project/{projectKey}:env/{envKey}</c>.
    /// For a <c>shared</c> segment, provide one or more scopes; shared segments can be used across multiple
    /// environments and require the ShareableSegment license feature. Besides an environment, a shared scope can
    /// target an organization (<c>organization/{orgKey}</c>) or a project (<c>organization/{orgKey}:project/{projectKey}</c>).
    /// Wildcards (<c>*</c>) are not allowed.
    /// </summary>
    /// <example>["organization/playground:project/example-project:env/dev"]</example>
    [Required(ErrorMessage = "scopes_is_invalid")]
    [MinLength(1, ErrorMessage = "scopes_is_invalid")]
    public string[] Scopes { get; set; } = [];
}

public class CreateSegment : CreateSegmentPayload, IRequest<Segment>
{
    public Guid WorkspaceId { get; set; }

    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

    public CreateSegment(Guid workspaceId, Guid orgId, Guid envId, CreateSegmentPayload payload)
    {
        WorkspaceId = workspaceId;
        OrgId = orgId;
        EnvId = envId;

        Type = payload.Type;
        Name = payload.Name;
        Key = payload.Key;
        Description = payload.Description;
        Scopes = payload.Scopes;
    }

    public Segment AsSegment()
    {
        return new Segment(WorkspaceId, EnvId, Name, Key, Type, Scopes, [], [], [], Description);
    }
}

public class CreateSegmentValidator : AbstractValidator<CreateSegment>
{
    public CreateSegmentValidator()
    {
        RuleFor(x => x.Type)
            .Must(SegmentType.IsDefined).WithErrorCode(ErrorCodes.Invalid("type"));

        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Invalid("name"))
            .MaximumLength(128).WithErrorCode(ErrorCodes.Invalid("name"));

        RuleFor(x => x.Key)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("key"))
            .MaximumLength(128).WithErrorCode(ErrorCodes.Invalid("key"))
            .Matches(Segment.KeyPattern).WithErrorCode(ErrorCodes.Invalid("key"));

        RuleFor(x => x.Scopes)
            .NotEmpty().WithErrorCode(ErrorCodes.Invalid("scopes"))
            .Must((request, scopes) =>
            {
                if (request.Type == SegmentType.EnvironmentSpecific)
                {
                    return scopes.Length == 1 && SegmentScope.IsValidEnvironmentScope(scopes[0]);
                }

                return scopes.All(SegmentScope.IsValidScope);
            })
            .WithErrorCode(ErrorCodes.Invalid("scopes"));
    }
}

public class CreateSegmentHandler(
    ISegmentService segmentService,
    ILicenseService licenseService,
    IPublisher publisher,
    ICurrentUser currentUser,
    SegmentCreationScopeGuard scopeGuard)
    : IRequestHandler<CreateSegment, Segment>
{
    public async ValueTask<Segment> Handle(CreateSegment request, CancellationToken cancellationToken)
    {
        if (request.Type == SegmentType.Shared)
        {
            var isShareableSegmentGranted =
                await licenseService.IsFeatureGrantedAsync(request.WorkspaceId, LicenseFeatures.ShareableSegment);
            if (!isShareableSegmentGranted)
            {
                throw new BusinessException(ErrorCodes.Unauthorized);
            }
        }

        // ensure scopes are allowed for the current user
        await scopeGuard.EnsureAllowedAsync(request);

        var segment = request.AsSegment();
        await segmentService.AddOneAsync(segment);

        // publish on segment created notification
        var dataChange = new DataChange(null).To(segment);

        var notification = new OnSegmentChange(segment, request.WorkspaceId, request.OrgId, Operations.Create, dataChange, currentUser.Id);
        await publisher.Publish(notification, cancellationToken);

        return segment;
    }
}
