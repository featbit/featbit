using Api.Authentication;
using Application.Bases.Exceptions;
using Application.ReleaseHealth;
using Application.Services;
using Domain.Policies;
using Domain.Resources;
using Infrastructure.ReleaseHealth;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/webhooks/release-health")]
[RequestSizeLimit(131072)]
public class ReleaseHealthWebhookController(ReleaseHealthService service, IResourceService resources) : ApiControllerBase
{
    private async Task<bool> Allowed(string[] scopes, string permission, bool requireAll, bool existing = false)
    {
        var statements = await GetRequestPermissionsAsync();
        var checks = new List<bool>();
        foreach (var (projectId, envId) in ReleaseHealthService.ParseMonitorWebhookScopes(scopes))
        {
            // Removed scopes have no remaining consumers. Do not treat denied or foreign scopes as removed.
            if (existing && !await service.StoredMonitorWebhookScopeExists(OrgId, projectId, envId)) continue;
            await service.Scope(OrgId, projectId, envId);
            var rn = await resources.GetEnvRnAsync(envId);
            checks.Add(rn is not null && PolicyHelper.IsAllowed(statements, rn, permission));
        }
        if (checks.Count == 0)
            return existing && PolicyHelper.IsAllowed(statements, RN.ForOrganization(), Permissions.UpdateOrgName);
        return requireAll ? checks.All(x => x) : checks.Any(x => x);
    }

    [OpenApi, HttpGet]
    public async Task<ApiResponse<IReadOnlyList<MonitorWebhookView>>> List(CancellationToken ct)
    {
        List<MonitorWebhookView> result = [];
        foreach (var item in await service.MonitorWebhooks(OrgId, ct))
        {
            if (!await Allowed(item.Scopes, Permissions.CanAccessEnv, false, existing: true)) continue;
            result.Add(item with { CanManage = await Allowed(item.Scopes, Permissions.UpdateEnvSettings, true, existing: true) });
        }
        return Ok<IReadOnlyList<MonitorWebhookView>>(result);
    }

    [OpenApi, HttpPost]
    public async Task<ApiResponse<MonitorWebhookView>> Create(MonitorWebhookWrite write, CancellationToken ct)
    {
        if (!await Allowed(write.Scopes, Permissions.UpdateEnvSettings, true)) throw new ForbiddenException();
        return Ok(await service.SaveMonitorWebhook(OrgId, null, write, CurrentUser.Id, ct));
    }

    [OpenApi, HttpPut("{id:guid}")]
    public async Task<ApiResponse<MonitorWebhookView>> Update(Guid id, MonitorWebhookWrite write, CancellationToken ct)
    {
        var previous = await service.MonitorWebhook(OrgId, id, ct);
        // Editing a shared target requires authority over its old AND new scopes.
        if (!await Allowed(previous.Scopes, Permissions.UpdateEnvSettings, true, existing: true) || !await Allowed(write.Scopes, Permissions.UpdateEnvSettings, true))
            throw new ForbiddenException();
        return Ok(await service.SaveMonitorWebhook(OrgId, id, write, CurrentUser.Id, ct));
    }

    [OpenApi, HttpDelete("{id:guid}")]
    public async Task<ApiResponse<bool>> Delete(Guid id, [FromQuery] long expectedVersion, CancellationToken ct)
    {
        var previous = await service.MonitorWebhook(OrgId, id, ct);
        if (!await Allowed(previous.Scopes, Permissions.UpdateEnvSettings, true, existing: true)) throw new ForbiddenException();
        await service.RemoveMonitorWebhook(OrgId, id, expectedVersion, CurrentUser.Id, ct);
        return Ok(true);
    }
}
