using Application.AuditLogs;
using Application.Bases;
using Application.Bases.Exceptions;
using Application.Users;
using Domain.AuditLogs;

namespace Application.Segments;

public class ArchiveSegment : ResourceChangeRequest, IRequest<bool>
{
    public Guid WorkspaceId { get; set; }

    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

    public Guid Id { get; set; }

    public ArchiveSegment(Guid workspaceId, Guid orgId, Guid envId, Guid id, ResourceChangeRequest payload = null)
    {
        WorkspaceId = workspaceId;
        OrgId = orgId;
        EnvId = envId;
        Id = id;

        Comment = payload?.Comment ?? string.Empty;
    }
}

public class ArchiveSegmentHandler(
    ISegmentService service,
    IPublisher publisher,
    ICurrentUser currentUser)
    : IRequestHandler<ArchiveSegment, bool>
{
    public async Task<bool> Handle(ArchiveSegment request, CancellationToken cancellationToken)
    {
        var segment = await service.GetAsync(request.Id);

        // check if the segment is being used in any environment before archiving
        var envIds = await service.GetEnvironmentIdsAsync(segment);
        foreach (var envId in envIds)
        {
            var flagReferences = await service.GetFlagReferencesAsync(envId, segment.Id);
            if (flagReferences.Count != 0)
            {
                throw new BusinessException(ErrorCodes.SegmentIsBeingUsed);
            }
        }

        var dataChange = segment.Archive();
        await service.UpdateAsync(segment);

        // publish on segment archived notification
        var notification = new OnSegmentChange(
            segment,
            request.WorkspaceId,
            request.OrgId,
            Operations.Archive,
            dataChange,
            currentUser.Id,
            comment: request.Comment,
            isTargetingChange: false
        );
        await publisher.Publish(notification, cancellationToken);

        return true;
    }
}
