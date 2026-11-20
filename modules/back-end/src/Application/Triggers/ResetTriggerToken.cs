namespace Application.Triggers;

public class ResetTriggerToken : IRequest<string>
{
    public Guid Id { get; set; }
}

public class ResetTriggerTokenHandler : IRequestHandler<ResetTriggerToken, string>
{
    private readonly ITriggerService _service;

    public ResetTriggerTokenHandler(ITriggerService service)
    {
        _service = service;
    }

    public async ValueTask<string> Handle(ResetTriggerToken request, CancellationToken cancellationToken)
    {
        var trigger = await _service.GetAsync(request.Id);
        trigger.ResetToken();

        await _service.UpdateAsync(trigger);

        return trigger.Token;
    }
}