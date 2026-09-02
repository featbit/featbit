using Api.Authentication;
using Application.ReleaseHealth;
using Domain.Policies;
using Infrastructure.ReleaseHealth;

namespace Api.Controllers;

[Authorize(Permissions.CanAccessProject)]
[Authorize(Permissions.CanAccessEnv)]
[Route("api/v{version:apiVersion}/projects/{projectId:guid}/envs/{envId:guid}/release-health")]
[RequestSizeLimit(32768)]
public class ReleaseHealthController(ReleaseHealthService service) : ApiControllerBase
{
    [OpenApi, HttpGet("connections"), Authorize(Permissions.UpdateEnvSettings)]
    public async Task<ApiResponse<IReadOnlyList<ConnectionView>>> Connections(Guid projectId, Guid envId, CancellationToken ct)
    {
        await service.Scope(OrgId, projectId, envId);
        return Ok(await service.Connections(envId, ct));
    }

    [OpenApi, HttpPost("connections/test"), Authorize(Permissions.UpdateEnvSettings)]
    public async Task<ApiResponse<bool>> Test(Guid projectId, Guid envId, ConnectionWrite write, CancellationToken ct)
    {
        await service.Scope(OrgId, projectId, envId);
        await service.TestOrSave(projectId, envId, null, write, CurrentUser.Id, false, ct);
        return Ok(true);
    }

    [OpenApi, HttpPost("connections/{id:guid}/test-draft"), Authorize(Permissions.UpdateEnvSettings)]
    public async Task<ApiResponse<bool>> TestDraft(Guid projectId, Guid envId, Guid id, ConnectionWrite write, CancellationToken ct)
    {
        await service.Scope(OrgId, projectId, envId);
        await service.TestOrSave(projectId, envId, id, write, CurrentUser.Id, false, ct);
        return Ok(true);
    }

    [OpenApi, HttpPost("connections/{id:guid}/test"), Authorize(Permissions.UpdateEnvSettings)]
    public async Task<ApiResponse<bool>> TestSaved(Guid projectId, Guid envId, Guid id, CancellationToken ct)
    {
        await service.Scope(OrgId, projectId, envId);
        await service.TestSaved(envId, id, CurrentUser.Id, ct);
        return Ok(true);
    }

    [OpenApi, HttpPost("connections"), Authorize(Permissions.UpdateEnvSettings)]
    public async Task<ApiResponse<ConnectionView?>> Create(Guid projectId, Guid envId, ConnectionWrite write, CancellationToken ct)
    {
        await service.Scope(OrgId, projectId, envId);
        return Ok(await service.TestOrSave(projectId, envId, null, write, CurrentUser.Id, true, ct));
    }

    [OpenApi, HttpPut("connections/{id:guid}"), Authorize(Permissions.UpdateEnvSettings)]
    public async Task<ApiResponse<ConnectionView?>> Update(Guid projectId, Guid envId, Guid id, ConnectionWrite write, CancellationToken ct)
    {
        await service.Scope(OrgId, projectId, envId);
        return Ok(await service.TestOrSave(projectId, envId, id, write, CurrentUser.Id, true, ct));
    }

    [OpenApi, HttpGet("metrics/{metricId:guid}/binding"), Authorize(Permissions.UpdateEnvSettings)]
    public async Task<ApiResponse<BindingView?>> Binding(Guid projectId, Guid envId, Guid metricId, CancellationToken ct)
    {
        await service.Scope(OrgId, projectId, envId);
        return Ok(await service.Binding(projectId, envId, metricId, ct));
    }

    [OpenApi, HttpPost("metrics/{metricId:guid}/binding/preview"), Authorize(Permissions.UpdateEnvSettings)]
    public async Task<ApiResponse<QueryView>> Preview(Guid projectId, Guid envId, Guid metricId, BindingWrite write, CancellationToken ct)
    {
        await service.Scope(OrgId, projectId, envId);
        return Ok((await service.PreviewOrSaveBinding(projectId, envId, metricId, write, false, CurrentUser.Id, ct)).Query);
    }

    [OpenApi, HttpPut("metrics/{metricId:guid}/binding"), Authorize(Permissions.UpdateEnvSettings)]
    public async Task<ApiResponse<BindingView>> SaveBinding(Guid projectId, Guid envId, Guid metricId, BindingWrite write, CancellationToken ct)
    {
        await service.Scope(OrgId, projectId, envId);
        return Ok((await service.PreviewOrSaveBinding(projectId, envId, metricId, write, true, CurrentUser.Id, ct)).Binding);
    }

    [OpenApi, HttpGet("metrics/{metricId:guid}/trend")]
    public async Task<ApiResponse<QueryView>> Trend(Guid projectId, Guid envId, Guid metricId, [FromQuery] int minutes = 15, CancellationToken ct = default)
    {
        await service.Scope(OrgId, projectId, envId);
        return Ok(await service.Trend(projectId, envId, metricId, minutes, ct));
    }
}

[Authorize(Permissions.CanAccessProject)]
[Route("api/v{version:apiVersion}/projects/{projectId:guid}/release-health/metrics")]
[RequestSizeLimit(16384)]
public class ReleaseHealthMetricsController(ReleaseHealthService service) : ApiControllerBase
{
    [OpenApi, HttpGet]
    public async Task<ApiResponse<IReadOnlyList<MetricView>>> List(Guid projectId, CancellationToken ct)
    {
        await service.Scope(OrgId, projectId);
        return Ok(await service.Metrics(projectId, ct));
    }
    [OpenApi, HttpPost, Authorize(Permissions.UpdateProjectSettings)]
    public async Task<ApiResponse<MetricView>> Create(Guid projectId, MetricWrite write, CancellationToken ct)
    {
        await service.Scope(OrgId, projectId);
        return Ok(await service.CreateMetric(projectId, write, ct));
    }
}
