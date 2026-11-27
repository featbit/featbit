using Application.Environments;
using Application.FeatureFlags;
using Domain.Policies;

namespace Application.Triggers;

public class DeleteTrigger : IRequest<bool>
{
    public DeleteTrigger(Guid id, Guid orgId, PolicyStatement[] permissions)
    {
        Id = id;
        OrgId = orgId;
        Permissions = permissions;
    }

    public Guid OrgId { get; set; }

    public PolicyStatement[] Permissions { get; set; } = [];

    public Guid Id { get; set; }
}

public class DeleteTriggerHandler(
    ITriggerService service,
    IFeatureFlagService flags,
    EnvironmentPermissionGuard envGuard,
    FlagPermissionGuard flagGuard) : IRequestHandler<DeleteTrigger, bool>
{
    public async ValueTask<bool> Handle(DeleteTrigger request, CancellationToken cancellationToken)
    {
        var trigger = await service.GetAsync(request.Id);

        var flag = await flags.GetAsync(trigger.TargetId);
        await envGuard.EnsureAccessAsync(request.OrgId, flag.EnvId, request.Permissions);
        await flagGuard.EnsureToggleAllowedAsync(request.OrgId, flag, request.Permissions);

        await service.DeleteOneAsync(trigger.Id);

        return true;
    }
}
