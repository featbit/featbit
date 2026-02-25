using Application.Bases;
using Application.Bases.Exceptions;
using Application.Users;
using Domain.AuditLogs;
using Domain.Segments;
using Domain.Workspaces;

namespace Application.Segments;

public class CreateSegment : IRequest<Segment>
{
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
    /// The scopes where the segment is applicable.
    /// </summary>
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
            .NotEmpty().WithErrorCode(ErrorCodes.Invalid("name"));

        RuleFor(x => x.Key)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("key"))
            .Matches(Segment.KeyPattern).WithErrorCode(ErrorCodes.Invalid("key"));

        RuleFor(x => x.Scopes)
            .NotEmpty().WithErrorCode(ErrorCodes.Invalid("scopes"))
            .Must(scopes => !scopes.Any(x => x.Contains('*'))).WithErrorCode(ErrorCodes.Invalid("scopes"));
    }
}

public class CreateSegmentHandler : IRequestHandler<CreateSegment, Segment>
{
    private readonly ISegmentService _segmentService;
    private readonly ILicenseService _licenseService;
    private readonly IPublisher _publisher;
    private readonly ICurrentUser _currentUser;

    public CreateSegmentHandler(
        ISegmentService segmentService,
        ILicenseService licenseService,
        IPublisher publisher,
        ICurrentUser currentUser)
    {
        _segmentService = segmentService;
        _licenseService = licenseService;
        _publisher = publisher;
        _currentUser = currentUser;
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

        var segment = request.AsSegment();
        await _segmentService.AddOneAsync(segment);

        // publish on segment created notification
        var dataChange = new DataChange(null).To(segment);
        var notification = new OnSegmentChange(segment, Operations.Create, dataChange, _currentUser.Id);
        await _publisher.Publish(notification, cancellationToken);

        return segment;
    }
}