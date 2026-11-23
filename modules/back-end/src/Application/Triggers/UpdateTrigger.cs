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

public class UpdateTriggerHandler(ITriggerService service, TriggerAccessGuard access) : IRequestHandler<UpdateTrigger, bool>
{
    public async Task<bool> Handle(UpdateTrigger request, CancellationToken cancellationToken)
    {
        var trigger = await access.GetAuthorizedTriggerAsync(request.OrgId, request.Permissions, request.Id);
        trigger.Update(request.IsEnabled);

        await service.UpdateAsync(trigger);

        return true;
    }
}