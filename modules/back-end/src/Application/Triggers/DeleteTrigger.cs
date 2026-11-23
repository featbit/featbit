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

public class DeleteTriggerHandler(ITriggerService service, TriggerAccessGuard access) : IRequestHandler<DeleteTrigger, bool>
{
    public async Task<bool> Handle(DeleteTrigger request, CancellationToken cancellationToken)
    {
        var trigger = await access.GetAuthorizedTriggerAsync(request.OrgId, request.Permissions, request.Id);
        await service.DeleteOneAsync(trigger.Id);

        return true;
    }
}