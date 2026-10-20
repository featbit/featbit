using Api.Authentication;
using Application.AuditLogs;
using Application.Bases.Models;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/envs/{envId:guid}/audit-logs")]
public class AuditLogController : ApiControllerBase
{
    /// <summary>Get feature flag and segment audit logs for an environment.</summary>
    [OpenApi]
    [HttpGet]
    public async Task<ApiResponse<PagedResult<AuditLogVm>>> GetListAsync(
        [FromRoute] Guid envId, [FromQuery] AuditLogFilter filter)
    {
        filter.EnvId = envId;
        return Ok(await Mediator.Send(new GetAuditLogList
        {
            WorkspaceId = WorkspaceId, OrgId = OrgId, Filter = filter
        }));
    }
}
