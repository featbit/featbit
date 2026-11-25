using Application.Environments;
using Application.FeatureFlags;
using Domain.Policies;

namespace Application.Triggers;

public class ResetTriggerToken : IRequest<string>
{
    public ResetTriggerToken(Guid id, Guid orgId, PolicyStatement[] permissions)
    {
        Id = id;
        OrgId = orgId;
        Permissions = permissions;
    }

    public Guid OrgId { get; set; }

    public PolicyStatement[] Permissions { get; set; } = [];

    public Guid Id { get; set; }
}

public class ResetTriggerTokenHandler(
    ITriggerService triggerService,
    IFeatureFlagService flagService,
    EnvironmentPermissionGuard envGuard,
    FlagPermissionGuard flagGuard) : IRequestHandler<ResetTriggerToken, string>
{
    public async Task<string> Handle(ResetTriggerToken request, CancellationToken cancellationToken)
    {
        var trigger = await triggerService.GetAsync(request.Id);

        var flag = await flagService.GetAsync(trigger.TargetId);
        await envGuard.EnsureAccessAsync(request.OrgId, flag.EnvId, request.Permissions);
        await flagGuard.EnsureToggleAllowedAsync(request.OrgId, flag, request.Permissions);

        trigger.ResetToken();

        await triggerService.UpdateAsync(trigger);

        return trigger.Token;
    }
}
