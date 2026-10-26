using Api.Authentication;
using Application.AuditLogs;
using Application.Bases.Models;

namespace Api.Controllers;

public class AuditLogController : ApiControllerBase
{
    /// <summary>
    /// Get environment audit logs
    /// </summary>
    /// <remarks>
    /// Get feature flag and segment audit logs for a specific environment, with optional filtering and pagination.
    /// </remarks>
    [OpenApi]
    [HttpGet("/api/v{version:apiVersion}/envs/{envId:guid}/audit-logs")]
    public async Task<ApiResponse<PagedResult<AuditLogVm>>> GetEnvironmentListAsync(Guid envId, [FromQuery] AuditLogFilter filter)
    {
        var request = new GetAuditLogList
        {
            WorkspaceId = WorkspaceId,
            EnvId = envId,
            Filter = filter
        };

        var auditLogs = await Mediator.Send(request);
        return Ok(auditLogs);
    }

    /// <summary>
    /// Get audit logs by scope
    /// </summary>
    /// <remarks>
    /// Query audit logs at the workspace, organization or environment level, with optional filtering and pagination.
    /// </remarks>
    [OpenApi]
    [HttpGet("/api/v{version:apiVersion}/audit-logs")]
    public async Task<ApiResponse<PagedResult<AuditLogVm>>> GetListAsync([FromQuery] AuditLogQueryFilter filter)
    {
        var request = new QueryAuditLogs
        {
            WorkspaceId = WorkspaceId,
            Filter = filter
        };

        var auditLogs = await Mediator.Send(request);
        return Ok(auditLogs);
    }
}
