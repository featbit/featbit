using Api.Authentication;
using Application.ReleaseMetricSourceConnections;
using Domain.Policies;

namespace Api.Controllers;

[OpenApi]
[Route("api/v{version:apiVersion}/envs/{envId:guid}/release-metric-source-connections")]
[Authorize(Permissions.CanAccessEnv)]
public class ReleaseMetricSourceConnectionController : ApiControllerBase
{
    /// <summary>List release metric source connections in an environment.</summary>
    /// <remarks>Requires CanAccessEnv in the owning organization. Only active connections are returned.</remarks>
    [HttpGet]
    public async Task<ApiResponse<IEnumerable<ReleaseMetricSourceConnectionVm>>> GetListAsync(Guid envId)
    {
        var request = new GetReleaseMetricSourceConnectionList { OrgId = OrgId, EnvId = envId };
        return Ok(await Mediator.Send(request, HttpContext.RequestAborted));
    }

    /// <summary>Get a release metric source connection and its settings.</summary>
    /// <remarks>Requires CanAccessEnv.</remarks>
    [HttpGet("{id:guid}")]
    public async Task<ApiResponse<ReleaseMetricSourceConnectionVm>> GetAsync(Guid envId, Guid id)
    {
        var request = new GetReleaseMetricSourceConnection { OrgId = OrgId, EnvId = envId, Id = id };
        return Ok(await Mediator.Send(request, HttpContext.RequestAborted));
    }

    /// <summary>Create a release metric source connection in an environment.</summary>
    /// <remarks>
    /// Requires CanAccessEnv and UpdateEnvSettings. Supply public connection settings and use secretUpdate for write-only credentials.
    /// </remarks>
    [HttpPost]
    [Authorize(Permissions.UpdateEnvSettings)]
    public async Task<ApiResponse<ReleaseMetricSourceConnectionVm>> CreateAsync(Guid envId, CreateReleaseMetricSourceConnection request)
    {
        request.OrgId = OrgId;
        request.EnvId = envId;
        return Ok(await Mediator.Send(request, HttpContext.RequestAborted));
    }

    /// <summary>Test a Prometheus-compatible connection using the current form values.</summary>
    /// <remarks>Supply a connectionId to reuse saved settings or credentials. The probe returns its status and optional reason without saving changes.</remarks>
    [HttpPost("test")]
    [Authorize(Permissions.UpdateEnvSettings)]
    public async Task<ApiResponse<ConnectionTestResult>> TestAsync(Guid envId, TestReleaseMetricSourceConnectionPayload payload)
    {
        var request = new TestReleaseMetricSourceConnection(OrgId, envId, payload);
        return Ok(await Mediator.Send(request, HttpContext.RequestAborted));
    }

    /// <summary>Update a release metric source connection's name and settings.</summary>
    /// <remarks>
    /// Requires CanAccessEnv and UpdateEnvSettings. Omit fields to keep their stored values. Use secretUpdate to replace credentials.
    /// </remarks>
    [HttpPut("{id:guid}")]
    [Authorize(Permissions.UpdateEnvSettings)]
    public async Task<ApiResponse<ReleaseMetricSourceConnectionVm>> UpdateAsync(Guid envId, Guid id, UpdateReleaseMetricSourceConnection request)
    {
        request.OrgId = OrgId;
        request.EnvId = envId;
        request.Id = id;
        return Ok(await Mediator.Send(request, HttpContext.RequestAborted));
    }

    /// <summary>Soft-delete a release metric source connection.</summary>
    /// <remarks>Requires CanAccessEnv and UpdateEnvSettings. Deleted connections are excluded from reads.</remarks>
    [HttpDelete("{id:guid}")]
    [Authorize(Permissions.UpdateEnvSettings)]
    public async Task<ApiResponse<bool>> DeleteAsync(Guid envId, Guid id)
    {
        var request = new DeleteReleaseMetricSourceConnection { OrgId = OrgId, EnvId = envId, Id = id };
        return Ok(await Mediator.Send(request, HttpContext.RequestAborted));
    }
}
