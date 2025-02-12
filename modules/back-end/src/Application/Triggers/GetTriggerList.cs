using Domain.Triggers;

namespace Application.Triggers;

public class GetTriggerList : IRequest<IEnumerable<Trigger>>
{
    public Guid TargetId { get; set; }
}

public class GetTriggerListHandler : IRequestHandler<GetTriggerList, IEnumerable<Trigger>>
{
    private readonly ITriggerService _service;

    public GetTriggerListHandler(ITriggerService service)
    {
        _service = service;
    }

    public async Task<IEnumerable<Trigger>> Handle(GetTriggerList request, CancellationToken cancellationToken)
    {
        var triggers = await _service.FindManyAsync(x => x.TargetId == request.TargetId);

        // obscure token
        foreach (var trigger in triggers)
        {
            trigger.Token = trigger.Token[..5] + "************************";
        }

        return triggers;
    }
}