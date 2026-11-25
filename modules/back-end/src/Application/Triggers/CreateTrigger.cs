using Application.Bases;
using Application.Environments;
using Application.FeatureFlags;
using Domain.Triggers;
using Domain.Policies;

namespace Application.Triggers;

public class CreateTriggerPayload
{
    public Guid TargetId { get; set; }

    public string Type { get; set; }

    public string Action { get; set; }

    public string Description { get; set; }
}

public class CreateTrigger : CreateTriggerPayload, IRequest<Trigger>
{
    public CreateTrigger(CreateTriggerPayload payload, Guid orgId, PolicyStatement[] permissions)
    {
        TargetId = payload.TargetId;
        Type = payload.Type;
        Action = payload.Action;
        Description = payload.Description;
        OrgId = orgId;
        Permissions = permissions;
    }

    public Guid OrgId { get; set; }

    public PolicyStatement[] Permissions { get; set; } = [];
}

public class CreateTriggerValidator : AbstractValidator<CreateTrigger>
{
    public CreateTriggerValidator()
    {
        RuleFor(x => x.Type)
            .Must(TriggerTypes.IsDefined).WithErrorCode(ErrorCodes.Invalid("type"));

        RuleFor(x => x.Action)
            .Must(TriggerActions.IsDefined).WithErrorCode(ErrorCodes.Invalid("action"));
    }
}

public class CreateTriggerHandler(
    ITriggerService triggerService,
    IFeatureFlagService flagService,
    EnvironmentPermissionGuard envGuard,
    FlagPermissionGuard flagGuard)
    : IRequestHandler<CreateTrigger, Trigger>
{
    public async Task<Trigger> Handle(CreateTrigger request, CancellationToken cancellationToken)
    {
        var flag = await flagService.GetAsync(request.TargetId);
        await envGuard.EnsureAccessAsync(request.OrgId, flag.EnvId, request.Permissions);
        await flagGuard.EnsureToggleAllowedAsync(request.OrgId, flag, request.Permissions);

        var trigger = new Trigger(
            Guid.NewGuid(),
            request.TargetId,
            request.Type,
            request.Action,
            request.Description
        );

        await triggerService.AddOneAsync(trigger);

        return trigger;
    }
}
