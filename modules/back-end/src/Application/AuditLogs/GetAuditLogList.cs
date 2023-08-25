using Application.Bases.Models;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.Segments;
using Domain.SemanticPatch;

namespace Application.AuditLogs;

public class GetAuditLogList : IRequest<PagedResult<AuditLogVm>>
{
    public Guid EnvId { get; set; }

    public AuditLogFilter Filter { get; set; }
}

public class GetAuditLogListHandler : IRequestHandler<GetAuditLogList, PagedResult<AuditLogVm>>
{
    private readonly IAuditLogService _auditLogService;
    private readonly IUserService _userService;
    private readonly IAccessTokenService _accessTokenService;
    private readonly IMapper _mapper;

    public GetAuditLogListHandler(
        IAuditLogService auditLogService,
        IUserService userService,
        IAccessTokenService accessTokenService,
        IMapper mapper)
    {
        _auditLogService = auditLogService;
        _userService = userService;
        _accessTokenService = accessTokenService;
        _mapper = mapper;
    }

    public async Task<PagedResult<AuditLogVm>> Handle(GetAuditLogList request, CancellationToken cancellationToken)
    {
        var logs = await _auditLogService.GetListAsync(request.EnvId, request.Filter);
        var logVms = _mapper.Map<PagedResult<AuditLogVm>>(logs);

        var users = await _userService.GetListAsync(logVms.Items.Select(x => x.CreatorId));
        foreach (var item in logVms.Items)
        {
            if (!string.IsNullOrWhiteSpace(item.DataChange.Previous) && !string.IsNullOrWhiteSpace(item.DataChange.Current))
            {
                switch (item.RefType)
                {
                    case AuditLogRefTypes.FeatureFlag:
                    {
                        var previous = item.DataChange.DeserializePrevious<FeatureFlag>();
                        var current = item.DataChange.DeserializeCurrent<FeatureFlag>();
                        item.Instructions = FlagComparer.Compare(previous, current);
                        break;
                    }
                    case AuditLogRefTypes.Segment:
                    {
                        var previous = item.DataChange.DeserializePrevious<Segment>();
                        var current = item.DataChange.DeserializeCurrent<Segment>();
                        item.Instructions = SegmentComparer.Compare(previous, current);
                        break;
                    }
                }
            }
            
            var user = users.FirstOrDefault(x => x.Id == item.CreatorId);
            if (user != null)
            {
                item.CreatorName = user.Name;
                item.CreatorEmail = user.Email;
                continue;
            }

            // An audit log may also be created by an access token
            var accessToken = await _accessTokenService.GetAsync(item.CreatorId);
            if (accessToken != null)
            {
                item.CreatorName = accessToken.Name;
                item.CreatorEmail = "Access token";
            }
        }

        return logVms;
    }
}