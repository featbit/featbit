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
        filter.Scope = AuditLogScope.Environment;
        filter.EnvId = envId;
        return Ok(await Mediator.Send(new GetAuditLogList
        {
            WorkspaceId = WorkspaceId, OrgId = OrgId, Filter = filter,
            Permissions = await GetRequestPermissionsAsync()
        }));
    }

    [HttpGet("~/api/v{version:apiVersion}/audit-logs")]
    public async Task<ApiResponse<PagedResult<AuditLogVm>>> QueryAsync(
        [FromQuery] AuditLogFilter filter)
    {
        return Ok(await Mediator.Send(new GetAuditLogList
        {
            WorkspaceId = WorkspaceId, OrgId = OrgId, Filter = filter,
            Permissions = await GetRequestPermissionsAsync()
        }));
    }

    [HttpGet("~/api/v{version:apiVersion}/audit-logs/actors")]
    public async Task<ApiResponse<AuditLogActorsVm>> Actors(
        [FromQuery] AuditLogFilter filter)
    {
        var actors = await Mediator.Send(new GetAuditLogActors
        {
            WorkspaceId = WorkspaceId, OrgId = OrgId, Filter = filter,
            Permissions = await GetRequestPermissionsAsync()
        });
        return Ok(new AuditLogActorsVm { Items = actors });
    }
}
