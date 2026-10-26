using Application.Bases;
using Application.Bases.Models;
using Domain.AuditLogs;
using Domain.SemanticPatch;

namespace Application.AuditLogs;

public class QueryAuditLogs : IRequest<PagedResult<AuditLogVm>>
{
    public Guid WorkspaceId { get; set; }

    public AuditLogQueryFilter Filter { get; set; }
}

public class QueryAuditLogsValidator : AbstractValidator<QueryAuditLogs>
{
    public QueryAuditLogsValidator()
    {
        RuleFor(x => x.Filter.Scope)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("scope"))
            .Must(AuditLogScopes.IsDefined).WithErrorCode(ErrorCodes.Invalid("scope"));

        RuleFor(x => x.Filter.ScopeId)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.Required("scopeId"));

        RuleForEach(x => x.Filter.RefTypes)
            .Must(AuditLogRefTypes.IsDefined)
            .WithErrorCode(ErrorCodes.Invalid("refTypes"));

        RuleFor(x => x.Filter)
            .Must(filter =>
                filter.Scope == AuditLogScopes.Environment &&
                !string.IsNullOrWhiteSpace(filter.RefId) &&
                filter.RefTypes is [AuditLogRefTypes.Segment]
            )
            .When(x => x.Filter.CrossEnvironment == true)
            .WithErrorCode(ErrorCodes.Invalid("crossEnvironment"));

        RuleFor(x => x.Filter.To)
            .GreaterThanOrEqualTo(x => x.Filter.From)
            .When(x => x.Filter.From.HasValue && x.Filter.To.HasValue)
            .WithErrorCode(ErrorCodes.Invalid("to"));
    }
}

public class QueryAuditLogsHandler(
    IAuditLogService auditLogService,
    IUserService userService,
    IAccessTokenService tokenService,
    IMapper mapper)
    : IRequestHandler<QueryAuditLogs, PagedResult<AuditLogVm>>
{
    public async Task<PagedResult<AuditLogVm>> Handle(QueryAuditLogs request, CancellationToken cancellationToken)
    {
        var result = await auditLogService.GetListAsync(request.WorkspaceId, request.Filter);
        var logVms = mapper.Map<PagedResult<AuditLogVm>>(result);

        var creators = await userService.GetListAsync(logVms.Items.Select(x => x.CreatorId));
        foreach (var item in logVms.Items)
        {
            item.Instructions = item.RefType switch
            {
                AuditLogRefTypes.FeatureFlag => FlagComparer.Compare(item.DataChange),
                AuditLogRefTypes.Segment => SegmentComparer.Compare(item.DataChange),
                _ => Array.Empty<Instruction>()
            };

            var user = creators.FirstOrDefault(x => x.Id == item.CreatorId);
            if (user != null)
            {
                item.CreatorName = user.Name;
                item.CreatorEmail = user.Email;
                continue;
            }

            // An operation can also be made by an access token through our Open Api, see "OpenApiHandler"
            var accessToken = await tokenService.FindOneAsync(x => x.Id == item.CreatorId);
            if (accessToken != null)
            {
                item.CreatorName = accessToken.Name;
                item.CreatorEmail = "Access token";
                continue;
            }

            // Otherwise this audit log is created by system user
            item.CreatorEmail = item.CreatorId == Guid.Empty ? "System" : "Unknown";
        }

        return logVms;
    }
}
