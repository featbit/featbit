using Application.Bases;
using Application.Bases.Exceptions;
using Application.Users;
using Domain.AuditLogs;
using Domain.Segments;
using Domain.Workspaces;

namespace Application.Segments;

public class CreateSegment : SegmentBase, IRequest<Segment>
{
    public Guid WorkspaceId { get; set; }

    public Guid EnvId { get; set; }

    public string Type { get; set; }

    public Segment AsSegment()
    {
        return new Segment(WorkspaceId, EnvId, Name, Type, Scopes, Included, Excluded, Rules, Description);
    }
}

public class CreateSegmentValidator : AbstractValidator<CreateSegment>
{
    public CreateSegmentValidator()
    {
        Include(new SegmentBaseValidator());

        RuleFor(x => x.Type)
            .Must(SegmentType.IsDefined).WithErrorCode(ErrorCodes.Invalid("type"));
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