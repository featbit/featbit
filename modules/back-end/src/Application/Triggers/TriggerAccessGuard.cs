#nullable enable
using Application.Bases.Exceptions;
using Application.Environments;
using Application.Policies;
using Domain.Policies;
using Domain.Triggers;

namespace Application.Triggers;

public class TriggerAccessGuard(IFeatureFlagService flags, ITriggerService triggers, EnvironmentPermissionGuard environments, IPermissionTargetResolver targets)
{
    public async Task EnsureTargetAccessAsync(Guid orgId, PolicyStatement[] permissions, Guid targetId, string? permission = null)
    {
        var flag = await flags.FindOneAsync(x => x.Id == targetId);
        if (flag == null) throw new ForbiddenException();
        await environments.EnsureAccessAsync(orgId, flag.EnvId, permissions);
        if (permission != null)
        {
            await PermissionGuard.EnsureAllowedAsync(orgId, [permission], permissions,
                () => targets.ResolveFlagAsync(flag.EnvId, flag.Key));
        }
    }

    public async Task<Trigger> GetAuthorizedTriggerAsync(Guid orgId, PolicyStatement[] permissions, Guid id)
    {
        var trigger = await triggers.FindOneAsync(x => x.Id == id);
        if (trigger == null || trigger.Type != TriggerTypes.FfGeneral) throw new ForbiddenException();
        await EnsureTargetAccessAsync(orgId, permissions, trigger.TargetId, Permissions.ToggleFlag);
        return trigger;
    }
}
