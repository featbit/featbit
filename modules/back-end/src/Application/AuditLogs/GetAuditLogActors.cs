using Domain.AuditLogs;

namespace Application.AuditLogs;

public class GetAuditLogActors : IRequest<IReadOnlyList<AuditActor>>
{
    public Guid WorkspaceId { get; set; }

    public Guid OrgId { get; set; }

    public AuditLogFilter Filter { get; set; }
}

public class GetAuditLogActorsHandler(IAuditLogService logs, IAuditLogAccess access)
    : IRequestHandler<GetAuditLogActors, IReadOnlyList<AuditActor>>
{
    public async Task<IReadOnlyList<AuditActor>> Handle(GetAuditLogActors request, CancellationToken cancellationToken)
    {
        await access.EnsureAsync(request.WorkspaceId, request.OrgId);
        return await logs.GetActorsAsync(request.WorkspaceId, request.Filter, request.OrgId);
    }
}
