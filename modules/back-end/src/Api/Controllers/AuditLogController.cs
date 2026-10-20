using Api.Authentication;
using Application.AuditLogs;
using Application.Bases.Models;
using Domain.Policies;

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

    [Authorize(Permissions.CanManageIAM)]
    [HttpGet("~/api/v{version:apiVersion}/iam/audit-logs")]
    public async Task<ApiResponse<PagedResult<AuditLogVm>>> GetIamListAsync([FromQuery] AuditLogFilter filter)
    {
        return Ok(await Mediator.Send(new GetAuditLogList
        {
            WorkspaceId = WorkspaceId, OrgId = OrgId, IsIam = true, Filter = filter
        }));
    }

    [Authorize(Permissions.CanManageIAM)]
    [HttpGet("~/api/v{version:apiVersion}/iam/audit-logs/actors")]
    public async Task<ApiResponse<AuditLogActorsVm>> IamActors([FromQuery] AuditLogFilter filter)
    {
        var actors = await Mediator.Send(new GetAuditLogActors
        {
            WorkspaceId = WorkspaceId, OrgId = OrgId, Filter = filter
        });
        return Ok(new AuditLogActorsVm { Items = actors });
    }
}
