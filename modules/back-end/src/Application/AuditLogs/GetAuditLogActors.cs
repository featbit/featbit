using Domain.Policies;
using Domain.AuditLogs;
using Application.Bases;

namespace Application.AuditLogs;

public class GetAuditLogActors : IRequest<IReadOnlyList<AuditActor>>
{
    public Guid WorkspaceId { get; set; }

    public Guid OrgId { get; set; }

    public Guid? EnvId { get; set; }

    public PolicyStatement[] Permissions { get; set; } = [];

    public AuditLogFilter Filter { get; set; }
}

public class GetAuditLogActorsValidator : AbstractValidator<GetAuditLogActors>
{
    public GetAuditLogActorsValidator()
    {
        RuleFor(x => x.Filter.Scope)
            .Must(scope => scope is AuditLogScope.Environment or AuditLogScope.Iam)
            .WithErrorCode(ErrorCodes.Invalid("scope"));
        RuleFor(x => x.EnvId).NotNull()
            .When(x => x.Filter.Scope == AuditLogScope.Environment)
            .WithErrorCode(ErrorCodes.Required("envId"));
    }
}

public class GetAuditLogActorsHandler(IAuditLogService logs, IAuditLogAccess access)
    : IRequestHandler<GetAuditLogActors, IReadOnlyList<AuditActor>>
{
    public async Task<IReadOnlyList<AuditActor>> Handle(GetAuditLogActors request, CancellationToken cancellationToken)
    {
        await access.EnsureAsync(request.Filter, request.Permissions);
        return await logs.GetActorsAsync(request.WorkspaceId, request.OrgId, request.EnvId, request.Filter);
    }
}
