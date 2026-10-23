using Api.Authentication;
using Application.AuditLogs;
using Application.Bases.Models;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/audit-logs")]
public class AuditLogController : ApiControllerBase
{
    /// <summary>
    /// Get a list of audit logs
    /// </summary>
    /// <remarks>
    /// Get the list of audit logs for a specific environment, with optional filtering and pagination.
    /// </remarks>
    [OpenApi]
    [HttpGet("~/api/v{version:apiVersion}/envs/{envId:guid}/audit-logs")]
    public async Task<ApiResponse<PagedResult<AuditLogVm>>> GetListAsync(Guid envId, [FromQuery] AuditLogFilter filter)
    {
        filter.Scope = AuditLogScope.Environment;
        return Ok(await Mediator.Send(new GetAuditLogList
        {
            WorkspaceId = WorkspaceId, OrgId = OrgId, EnvId = envId, Filter = filter,
            Permissions = await GetRequestPermissionsAsync()
        }));
    }

    [HttpGet]
    public async Task<ApiResponse<PagedResult<AuditLogVm>>> QueryAsync(
        [FromQuery] AuditLogFilter filter, [FromQuery] Guid? envId = null)
    {
        return Ok(await Mediator.Send(new GetAuditLogList
        {
            WorkspaceId = WorkspaceId, OrgId = OrgId, EnvId = envId, Filter = filter,
            Permissions = await GetRequestPermissionsAsync()
        }));
    }
}
