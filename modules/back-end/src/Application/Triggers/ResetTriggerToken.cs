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

public class ResetTriggerTokenHandler(ITriggerService service, TriggerAccessGuard access) : IRequestHandler<ResetTriggerToken, string>
{
    public async Task<string> Handle(ResetTriggerToken request, CancellationToken cancellationToken)
    {
        var trigger = await access.GetAuthorizedTriggerAsync(request.OrgId, request.Permissions, request.Id);
        trigger.ResetToken();

        await service.UpdateAsync(trigger);

        return trigger.Token;
    }
}