using Api.Authentication;
using System.Text.Json;
using System.Text.Json.Nodes;
using Application.Bases.Exceptions;
using Application.ReleaseHealth;
using Application.Services;
using Domain.FeatureFlags;
using Domain.AuditLogs;
using Domain.Policies;
using Infrastructure.ReleaseHealth;

namespace Api.Controllers;

[Authorize(Permissions.CanAccessProject)]
[Authorize(Permissions.CanAccessEnv)]
[Route("api/v{version:apiVersion}/projects/{projectId:guid}/envs/{envId:guid}/release-health/flags/{flagId:guid}/monitor")]
[RequestSizeLimit(65536)]
public class ReleaseHealthMonitorsController(ReleaseHealthService service, IFeatureFlagService flags,
    IResourceService resources, IAuditLogService auditLogs) : ApiControllerBase
{
    private string Source => User.Identity?.AuthenticationType == Schemes.OpenApi ? "API" : "UI";

    private async Task<FeatureFlag> ScopedFlag(Guid projectId, Guid envId, Guid flagId, bool write)
    {
        await service.Scope(OrgId, projectId, envId);
        var flag = await flags.FindOneAsync(x => x.Id == flagId && x.EnvId == envId)
            ?? throw new EntityNotFoundException("FeatureFlag", flagId.ToString());
        if (write)
        {
            // Generic flag authorization expects a {key} route. Resolve this UUID route
            // explicitly so a flag-specific deny cannot be bypassed by a flag/* check.
            var rn = await resources.GetFlagRnAsync(envId, flag.Key);
            if (rn is null || !PolicyHelper.IsAllowed(await GetRequestPermissionsAsync(), rn,
                    Permissions.UpdateFlagTargetingRules)) throw new ForbiddenException();
        }
        return flag;
    }

    private static JsonObject AuditSnapshot(FeatureFlag flag, MonitorView monitor)
    {
        // Keep the existing FeatureFlag audit reference and flag shape; raw audit data
        // additionally exposes the monitor change without publishing a targeting change.
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        var snapshot = JsonSerializer.SerializeToNode(flag, options)!.AsObject();
        snapshot["releaseHealthMonitor"] = JsonSerializer.SerializeToNode(monitor, options);
        return snapshot;
    }

    private async Task<ApiResponse<MonitorView>> Mutate(Guid projectId, Guid envId, Guid flagId,
        string operation, Func<FeatureFlag, Task<MonitorView>> mutate, CancellationToken ct)
    {
        var flag = await ScopedFlag(projectId, envId, flagId, true);
        var before = await service.Monitor(OrgId, projectId, envId, flag, ct);
        var after = await mutate(flag);
        if (after.Revision != before.Revision)
            await auditLogs.AddOneAsync(AuditLog.For(flag, Operations.Update,
                new DataChange(AuditSnapshot(flag, before)).To(AuditSnapshot(flag, after)),
                "Release Health: " + operation, CurrentUser.Id));
        return Ok(after);
    }

    [OpenApi, HttpGet]
    public async Task<ApiResponse<MonitorView>> Get(Guid projectId, Guid envId, Guid flagId, CancellationToken ct) =>
        Ok(await service.Monitor(OrgId, projectId, envId, await ScopedFlag(projectId, envId, flagId, false), ct));

    [OpenApi, HttpGet("metrics")]
    public async Task<ApiResponse<IReadOnlyList<MonitorMetricView>>> Metrics(Guid projectId, Guid envId, Guid flagId, CancellationToken ct) =>
        Ok(await service.MonitorMetrics(OrgId, projectId, envId, await ScopedFlag(projectId, envId, flagId, false), ct));

    [OpenApi, HttpPut("status")]
    public async Task<ApiResponse<MonitorView>> Status(Guid projectId, Guid envId, Guid flagId,
        MonitorStatusWrite write, CancellationToken ct) =>
        await Mutate(projectId, envId, flagId, "monitor status changed", flag =>
            service.SetMonitorStatus(OrgId, projectId, envId, flag, write, CurrentUser.Id, Source, ct), ct);

    [OpenApi, HttpPost("bindings")]
    public async Task<ApiResponse<MonitorView>> AddBinding(Guid projectId, Guid envId, Guid flagId,
        MonitorBindingWrite write, CancellationToken ct) =>
        await Mutate(projectId, envId, flagId, "metric binding added", flag =>
            service.AddMonitorBinding(OrgId, projectId, envId, flag, write, CurrentUser.Id, Source, ct), ct);

    [OpenApi, HttpPut("bindings/{bindingId:guid}")]
    public async Task<ApiResponse<MonitorView>> UpdateBinding(Guid projectId, Guid envId, Guid flagId, Guid bindingId,
        MonitorBindingWrite write, CancellationToken ct) =>
        await Mutate(projectId, envId, flagId, "metric binding updated", flag =>
            service.UpdateMonitorBinding(OrgId, projectId, envId, flag, bindingId, write, CurrentUser.Id, Source, ct), ct);

    [OpenApi, HttpPut("bindings/{bindingId:guid}/status")]
    public async Task<ApiResponse<MonitorView>> BindingStatus(Guid projectId, Guid envId, Guid flagId, Guid bindingId,
        MonitorStatusWrite write, CancellationToken ct) =>
        await Mutate(projectId, envId, flagId, "metric binding status changed", flag =>
            service.SetMonitorBindingStatus(OrgId, projectId, envId, flag, bindingId, write, CurrentUser.Id, Source, ct), ct);

    [OpenApi, HttpDelete("bindings/{bindingId:guid}")]
    public async Task<ApiResponse<MonitorView>> RemoveBinding(Guid projectId, Guid envId, Guid flagId, Guid bindingId,
        [FromQuery] long expectedRevision, CancellationToken ct) =>
        await Mutate(projectId, envId, flagId, "metric binding removed", flag =>
            service.RemoveMonitorBinding(OrgId, projectId, envId, flag, bindingId, expectedRevision, CurrentUser.Id, Source, ct), ct);
}
