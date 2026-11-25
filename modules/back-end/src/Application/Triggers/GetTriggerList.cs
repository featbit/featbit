using Application.Environments;
using Domain.Triggers;
using Domain.Policies;

namespace Application.Triggers;

public class GetTriggerList : IRequest<IEnumerable<Trigger>>
{
    public GetTriggerList(Guid targetId, Guid orgId, PolicyStatement[] permissions)
    {
        TargetId = targetId;
        OrgId = orgId;
        Permissions = permissions;
    }

    public Guid OrgId { get; set; }

    public PolicyStatement[] Permissions { get; set; } = [];

    public Guid TargetId { get; set; }
}

public class GetTriggerListHandler(
    ITriggerService triggerService,
    IFeatureFlagService flagService,
    EnvironmentPermissionGuard envGuard) : IRequestHandler<GetTriggerList, IEnumerable<Trigger>>
{
    public async Task<IEnumerable<Trigger>> Handle(GetTriggerList request, CancellationToken cancellationToken)
    {
        var flag = await flagService.GetAsync(request.TargetId);

        await envGuard.EnsureAccessAsync(request.OrgId, flag.EnvId, request.Permissions);

        var triggers = await triggerService.FindManyAsync(x => x.TargetId == request.TargetId);

        // obscure token
        foreach (var trigger in triggers)
        {
            trigger.Token = trigger.Token[..5] + "************************";
        }

        return triggers.OrderByDescending(x => x.CreatedAt);
    }
}
