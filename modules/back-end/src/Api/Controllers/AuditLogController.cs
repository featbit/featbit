using Application.AuditLogs;
using Application.Bases.Models;
using Domain.SemanticPatch;

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

    [HttpPost(("compare"))]
    public async Task<ApiResponse<IEnumerable<Instruction>>> CompareAsync(Compare request)
    {
        var instructions = await Mediator.Send(request);
        return Ok(instructions);
    }
}