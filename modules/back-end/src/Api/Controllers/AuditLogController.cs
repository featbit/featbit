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
    /// Get the list of audit logs in the current workspace (optionally filtered by environment), with optional filtering and pagination.
    /// </remarks>
    [OpenApi]
    [HttpGet]
    public async Task<ApiResponse<PagedResult<AuditLogVm>>> GetListAsync([FromQuery] AuditLogFilter filter)
    {
        var request = new GetAuditLogList
        {
            WorkspaceId = WorkspaceId,
            OrgId = OrgId,
            Filter = filter
        };

        var auditLogs = await Mediator.Send(request);
        return Ok(auditLogs);
    }

    /// <summary>
    /// Deprecated: Get a list of audit logs for a specific environment
    /// </summary>
    /// <remarks>
    /// This endpoint is deprecated. Use GET /api/v{version}/audit-logs?envId={envId} instead.
    /// Retained for compatibility. The route environment takes precedence over query parameters.
    /// </remarks>
    [OpenApi]
    [HttpGet("/api/v{version:apiVersion}/envs/{envId:guid}/audit-logs")]
    public Task<ApiResponse<PagedResult<AuditLogVm>>> GetListAsync(
        [FromRoute] Guid envId, [FromQuery] AuditLogFilter filter)
    {
        filter.EnvId = envId;
        return GetListAsync(filter);
    }

    [HttpGet("actors")]
    public async Task<ApiResponse<AuditLogActorsVm>> Actors([FromQuery] AuditLogFilter filter)
    {
        var actors = await Mediator.Send(new GetAuditLogActors
        {
            WorkspaceId = WorkspaceId,
            OrgId = OrgId,
            Filter = filter
        });
        
        return Ok(new AuditLogActorsVm { Items = actors });
    }
}
