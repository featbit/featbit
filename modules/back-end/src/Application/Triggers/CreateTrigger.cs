using Application.Bases;
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

public class CreateTriggerHandler : IRequestHandler<CreateTrigger, Trigger>
{
    private readonly ITriggerService _service;
    private readonly TriggerAccessGuard _access;

    public CreateTriggerHandler(ITriggerService service, TriggerAccessGuard access)
    {
        _service = service;
        _access = access;
    }

    public async Task<Trigger> Handle(CreateTrigger request, CancellationToken cancellationToken)
    {
        await _access.EnsureTargetAccessAsync(request.OrgId, request.Permissions, request.TargetId, Permissions.ToggleFlag);

        var trigger = new Trigger(
            Guid.NewGuid(),
            request.TargetId,
            request.Type,
            request.Action,
            request.Description
        );

        await _service.AddOneAsync(trigger);

        return trigger;
    }
}