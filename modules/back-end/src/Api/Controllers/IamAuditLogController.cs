using Application.AuditLogs;
using Application.Bases.Models;
using Domain.Policies;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/iam/audit-logs")]
[Authorize(Permissions.CanManageIAM)]
public class IamAuditLogController : ApiControllerBase
{
    [HttpGet]
    public async Task<ApiResponse<PagedResult<AuditLogVm>>> GetListAsync([FromQuery] AuditLogFilter filter)
    {
        return Ok(await Mediator.Send(new GetAuditLogList
        {
            WorkspaceId = WorkspaceId, OrgId = OrgId, IsIam = true, Filter = filter
        }));
    }

    [HttpGet("actors")]
    public async Task<ApiResponse<AuditLogActorsVm>> Actors([FromQuery] AuditLogFilter filter)
    {
        var actors = await Mediator.Send(new GetAuditLogActors
        {
            WorkspaceId = WorkspaceId, OrgId = OrgId, Filter = filter
        });
        return Ok(new AuditLogActorsVm { Items = actors });
    }
}
