using Application.AuditLogs;
using Application.Bases.Models;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/envs/{envId:guid}/audit-logs")]
public class AuditLogController : ApiControllerBase
{
    [HttpGet]
    public async Task<ApiResponse<PagedResult<AuditLogVm>>> GetListAsync(Guid envId, [FromQuery] AuditLogFilter filter)
    {
        var request = new GetAuditLogList
        {
            EnvId = envId,
            Filter = filter
        };

        var auditLogs = await Mediator.Send(request);
        return Ok(auditLogs);
    }
}