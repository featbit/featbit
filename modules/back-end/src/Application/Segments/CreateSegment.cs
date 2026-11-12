using System.ComponentModel.DataAnnotations;
using Application.Bases;
using Application.Bases.Exceptions;
using Application.Users;
using Domain.AuditLogs;
using Domain.Resources;
using Domain.Policies;
using Domain.Segments;
using Domain.Workspaces;

namespace Application.Segments;

public class CreateSegment : IRequest<Segment>
{
    public Guid OrgId { get; set; }

    /// <summary>
    /// The ID of the workspace the segment belongs to. Retrieved from the request header.
    /// </summary>
    public Guid WorkspaceId { get; set; }

    /// <summary>
    /// The ID of the environment the segment belongs to. Retrieved from URL path.
    /// </summary>
    public Guid EnvId { get; set; }

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
            .Must(scopes => scopes.All(IsValidScope)).WithErrorCode(ErrorCodes.Invalid("scopes"));
    }

    private static bool IsValidScope(string scope)
    {
        if (!RN.TryParse(scope, out var parsed)) return false;
        var parts = parsed.ToArray();
        string[] types = [ResourceTypes.Organization, ResourceTypes.Project, ResourceTypes.Env];
        return parts.Length is >= 1 and <= 3 && parts.Select((part, index) =>
            part.Type == types[index] && !string.IsNullOrWhiteSpace(part.Key) &&
            !part.Key.Any(c => c is '*' or ';' or '/' || char.IsWhiteSpace(c))).All(valid => valid);
    }
}

public class CreateSegmentHandler : IRequestHandler<CreateSegment, Segment>
{
    private readonly ISegmentService _segmentService;
    private readonly ILicenseService _licenseService;
    private readonly IPublisher _publisher;
    private readonly ICurrentUser _currentUser;
    private readonly IOrganizationService _organizations;
    private readonly IProjectService _projects;
    private readonly IEnvironmentService _environments;
    private readonly IOrganizationPermissions _permissions;

    public CreateSegmentHandler(
        ISegmentService segmentService,
        ILicenseService licenseService,
        IPublisher publisher,
        ICurrentUser currentUser,
        IOrganizationService organizations,
        IProjectService projects,
        IEnvironmentService environments,
        IOrganizationPermissions permissions)
    {
        _segmentService = segmentService;
        _licenseService = licenseService;
        _publisher = publisher;
        _currentUser = currentUser;
        _organizations = organizations;
        _projects = projects;
        _environments = environments;
        _permissions = permissions;
    }

    public async Task<Segment> Handle(CreateSegment request, CancellationToken cancellationToken)
    {
        if (request.Type == SegmentType.Shared)
        {
            var isShareableSegmentGranted =
                await _licenseService.IsFeatureGrantedAsync(request.WorkspaceId, LicenseFeatures.ShareableSegment);
            if (!isShareableSegmentGranted)
            {
                throw new BusinessException(ErrorCodes.Unauthorized);
            }
        }

        await EnsureScopesAllowedAsync(request);
        var segment = request.AsSegment();
        await _segmentService.AddOneAsync(segment);

        // publish on segment created notification
        var dataChange = new DataChange(null).To(segment);

        var notification = new OnSegmentChange(segment, request.WorkspaceId, request.OrgId, Operations.Create, dataChange, _currentUser.Id);
        await _publisher.Publish(notification, cancellationToken);

        return segment;
    }

    private async Task EnsureScopesAllowedAsync(CreateSegment request)
    {
        foreach (var scope in request.Scopes.Distinct())
        {
            // The validator checks the shape; resolve every level in its parent scope.
            RN.TryParse(scope, out var parsed);
            var parts = parsed.ToArray();
            var org = await _organizations.FindOneAsync(x => x.WorkspaceId == request.WorkspaceId && x.Key == parts[0].Key);
            if (org == null) throw new ForbiddenException();
            var relativeRn = "project/*:env/*";
            Guid? scopeEnvId = null;
            if (parts.Length > 1)
            {
                var project = await _projects.FindOneAsync(x => x.OrganizationId == org.Id && x.Key == parts[1].Key);
                if (project == null) throw new ForbiddenException();
                relativeRn = $"project/{project.Key}:env/*";
                if (parts.Length > 2)
                {
                    var env = await _environments.FindOneAsync(x => x.ProjectId == project.Id && x.Key == parts[2].Key);
                    if (env == null) throw new ForbiddenException();
                    scopeEnvId = env.Id;
                    relativeRn = $"project/{project.Key}:env/{env.Key}";
                }
            }
            if (request.Type == SegmentType.EnvironmentSpecific &&
                (request.Scopes.Length != 1 || scopeEnvId != request.EnvId || org.Id != request.OrgId))
                throw new ForbiddenException();
            var policies = await _permissions.GetAsync(org.Id);
            if (!IsScopeAllowed(policies, relativeRn, Permissions.CanAccessEnv) ||
                !IsScopeAllowed(policies, $"{relativeRn}:segment/{request.Key}", Permissions.CreateSegment))
                throw new ForbiddenException();
        }
    }

    // A broad sharing scope must not bypass a deny on one of its narrower environments.
    private static bool IsScopeAllowed(PolicyStatement[] policies, string rn, string action) =>
        PolicyHelper.IsAllowed(policies, rn, action) && !policies.Any(policy =>
            policy.Effect == EffectType.Deny &&
            policy.Actions.Any(a => a == "*" || a == action) &&
            policy.Resources.Any(pattern => IntersectsScope(rn, pattern)));

    private static bool IntersectsScope(string rn, string denyPattern)
    {
        var scopeParts = rn.Split(':');
        var denyParts = denyPattern.Split(':');
        if (denyParts.Length > scopeParts.Length) return false;
        for (var index = 0; index < denyParts.Length; index++)
        {
            var scopePart = scopeParts[index];
            var denyPart = denyParts[index];
            var scopePath = scopePart.Split(';')[0];
            var denyPath = denyPart.Split(';')[0];
            // Generated scope paths contain only concrete keys or a whole-key '*'.
            if (!RNMatcher.IsMatch(scopePath, denyPath) && !RNMatcher.IsMatch(denyPath, scopePath))
                return false;

            // Match deny tags only against the resource's tags, never in reverse.
            // Reusing the scope path here isolates tag matching from path overlap.
            var tagStart = denyPart.IndexOf(';');
            if (tagStart >= 0 && !RNMatcher.IsMatch(scopePart, scopePath + denyPart[tagStart..]))
                return false;
        }
        return true;
    }
}
