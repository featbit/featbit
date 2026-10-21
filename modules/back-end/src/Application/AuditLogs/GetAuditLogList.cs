using Domain.Policies;
using Application.Bases.Models;
using Domain.AuditLogs;
using Domain.SemanticPatch;

namespace Application.AuditLogs;

public class GetAuditLogList : IRequest<PagedResult<AuditLogVm>>
{
    public Guid WorkspaceId { get; set; }

    public Guid OrgId { get; set; }

    public Guid? EnvId { get; set; }

    public PolicyStatement[] Permissions { get; set; } = [];

    public AuditLogFilter Filter { get; set; }
}

public class GetAuditLogListHandler : IRequestHandler<GetAuditLogList, PagedResult<AuditLogVm>>
{
    private readonly IAuditLogService _auditLogService;
    private readonly IUserService _userService;
    private readonly IAccessTokenService _accessTokenService;
    private readonly IMapper _mapper;
    private readonly IAuditLogAccess _access;

    public GetAuditLogListHandler(
        IAuditLogService auditLogService,
        IUserService userService,
        IAccessTokenService accessTokenService,
        IMapper mapper,
        IAuditLogAccess access)
    {
        _auditLogService = auditLogService;
        _userService = userService;
        _accessTokenService = accessTokenService;
        _mapper = mapper;
        _access = access;
    }

    public async Task<PagedResult<AuditLogVm>> Handle(GetAuditLogList request, CancellationToken cancellationToken)
    {
        await _access.EnsureAsync(request.Filter, request.Permissions);
        var logs = await _auditLogService.GetListAsync(request.WorkspaceId, request.OrgId, request.EnvId, request.Filter);
        var logVms = _mapper.Map<PagedResult<AuditLogVm>>(logs);

        var users = await _userService.GetListAsync(logVms.Items.Select(x => x.CreatorId));
        foreach (var (log, item) in logs.Items.Zip(logVms.Items))
        {
            item.Instructions = item.RefType switch
            {
                AuditLogRefTypes.FeatureFlag => FlagComparer.Compare(log.DataChange),
                AuditLogRefTypes.Segment => SegmentComparer.Compare(log.DataChange),
                _ => Array.Empty<Instruction>()
            };

            var user = users.FirstOrDefault(x => x.Id == item.CreatorId);
            if (user != null)
            {
                item.CreatorName = user.Name;
                item.CreatorEmail = user.Email;
                continue;
            }

            // An operation can also be made by an access token through our Open Api, see "OpenApiHandler"
            var accessToken = await _accessTokenService.FindOneAsync(x => x.Id == item.CreatorId);
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
