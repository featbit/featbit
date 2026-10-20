using Domain.Policies;
using Application.Bases.Models;
using Domain.AuditLogs;
using Domain.SemanticPatch;

namespace Application.AuditLogs;

public class GetAuditLogList : IRequest<PagedResult<AuditLogVm>>
{
    public Guid WorkspaceId { get; set; }

    public Guid OrgId { get; set; }

    public PolicyStatement[] Permissions { get; set; } = [];

    public AuditLogFilter Filter { get; set; }
}

public class GetAuditLogListHandler : IRequestHandler<GetAuditLogList, PagedResult<AuditLogVm>>
{
    private readonly IAuditLogService _auditLogService;
    private readonly IUserService _userService;
    private readonly IAccessTokenService _accessTokenService;
    private readonly IMapper _mapper;
    private readonly IOrganizationService _organizations;
    private readonly IEnvironmentService _environments;
    private readonly IProjectService _projects;
    private readonly IAuditLogAccess _access;

    public GetAuditLogListHandler(
        IAuditLogService auditLogService,
        IUserService userService,
        IAccessTokenService accessTokenService,
        IMapper mapper, IOrganizationService organizations, IEnvironmentService environments, IProjectService projects,
        IAuditLogAccess access)
    {
        _auditLogService = auditLogService;
        _userService = userService;
        _accessTokenService = accessTokenService;
        _mapper = mapper;
        _organizations = organizations;
        _environments = environments;
        _projects = projects;
        _access = access;
    }

    public async Task<PagedResult<AuditLogVm>> Handle(GetAuditLogList request, CancellationToken cancellationToken)
    {
        await _access.EnsureAsync(request.WorkspaceId, request.OrgId);
        await AuditLogScopeRules.ValidateAsync(
            request.Filter, request.OrgId, request.Permissions, _environments, _projects);
        var logs = await _auditLogService.GetListAsync(request.WorkspaceId, request.OrgId, request.Filter);
        var logVms = _mapper.Map<PagedResult<AuditLogVm>>(logs);

        var users = await _userService.GetListAsync(logVms.Items.Select(x => x.CreatorId));
        // Display scope is resolved at read time; these names are not audit columns.
        var orgIds = logVms.Items.Where(x => x.OrganizationId.HasValue).Select(x => x.OrganizationId.Value).Distinct().ToArray();
        var envIds = logVms.Items.Where(x => x.EnvId.HasValue).Select(x => x.EnvId.Value).Distinct().ToArray();
        var orgs = await _organizations.FindManyAsync(x => orgIds.Contains(x.Id));
        var envs = await _environments.FindManyAsync(x => envIds.Contains(x.Id));
        var projectIds = envs.Select(x => x.ProjectId).Distinct().ToArray();
        var projects = await _projects.FindManyAsync(x => projectIds.Contains(x.Id));
        foreach (var (log, item) in logs.Items.Zip(logVms.Items))
        {
            item.OrganizationName = orgs.FirstOrDefault(x => x.Id == item.OrganizationId)?.Name;
            var env = envs.FirstOrDefault(x => x.Id == item.EnvId);
            item.EnvironmentName = env?.Name;
            item.ProjectName = projects.FirstOrDefault(x => x.Id == env?.ProjectId)?.Name;
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
