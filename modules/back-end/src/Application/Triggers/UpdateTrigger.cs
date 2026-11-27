using Application.Environments;
using Application.FeatureFlags;
using Domain.Policies;

namespace Application.Triggers;

public class UpdateTriggerPayload
{
    public bool IsEnabled { get; set; }
}

public class UpdateTrigger : UpdateTriggerPayload, IRequest<bool>
{
    public UpdateTrigger(UpdateTriggerPayload payload, Guid id, Guid orgId, PolicyStatement[] permissions)
    {
        IsEnabled = payload.IsEnabled;
        Id = id;
        OrgId = orgId;
        Permissions = permissions;
    }

    public Guid Id { get; set; }

    public Guid OrgId { get; set; }

    public PolicyStatement[] Permissions { get; set; } = [];
}

public class UpdateTriggerHandler(
    ITriggerService triggerService,
    IFeatureFlagService flagService,
    EnvironmentPermissionGuard envGuard,
    FlagPermissionGuard flagGuard) : IRequestHandler<UpdateTrigger, bool>
{
    public async ValueTask<bool> Handle(UpdateTrigger request, CancellationToken cancellationToken)
    {
        var trigger = await triggerService.GetAsync(request.Id);

        var flag = await flagService.GetAsync(trigger.TargetId);
        await envGuard.EnsureAccessAsync(request.OrgId, flag.EnvId, request.Permissions);
        await flagGuard.EnsureToggleAllowedAsync(request.OrgId, flag, request.Permissions);

        trigger.Update(request.IsEnabled);

        await triggerService.UpdateAsync(trigger);

        return true;
    }
}
