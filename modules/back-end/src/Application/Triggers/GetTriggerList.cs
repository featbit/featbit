using Domain.Triggers;

namespace Application.Triggers;

public class GetTriggerList : IRequest<IEnumerable<Trigger>>
{
    public Guid TargetId { get; set; }
}

public class GetTriggerListHandler(ITriggerService service) : IRequestHandler<GetTriggerList, IEnumerable<Trigger>>
{
    public async Task<IEnumerable<Trigger>> Handle(GetTriggerList request, CancellationToken cancellationToken)
    {
        var triggers = await service.FindManyAsync(x => x.TargetId == request.TargetId);

        // obscure token
        foreach (var trigger in triggers)
        {
            trigger.Token = trigger.Token[..5] + "************************";
        }

        return triggers.OrderByDescending(x => x.CreatedAt);
    }
}