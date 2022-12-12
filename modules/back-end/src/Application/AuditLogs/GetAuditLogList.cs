using Application.Bases.Models;

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
    private readonly IMapper _mapper;

    public GetAuditLogListHandler(IAuditLogService auditLogService, IUserService userService, IMapper mapper)
    {
        _auditLogService = auditLogService;
        _userService = userService;
        _mapper = mapper;
    }

    public async Task<PagedResult<AuditLogVm>> Handle(GetAuditLogList request, CancellationToken cancellationToken)
    {
        var logs = await _auditLogService.GetListAsync(request.EnvId, request.Filter);
        var logVms = _mapper.Map<PagedResult<AuditLogVm>>(logs);

        var users = await _userService.GetListAsync(logVms.Items.Select(x => x.CreatorId));
        foreach (var item in logVms.Items)
        {
            var user = users.FirstOrDefault(x => x.Id == item.CreatorId);
            if (user == null)
            {
                continue;
            }

            item.CreatorName = user.Name;
            item.CreatorEmail = user.Email;
        }

        return logVms;
    }
}