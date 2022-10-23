namespace Application.Triggers;

public class UpdateTrigger : IRequest<bool>
{
    public Guid Id { get; set; }

    public bool IsEnabled { get; set; }
}

public class UpdateTriggerHandler : IRequestHandler<UpdateTrigger, bool>
{
    private readonly ITriggerService _service;

    public UpdateTriggerHandler(ITriggerService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(UpdateTrigger request, CancellationToken cancellationToken)
    {
        var trigger = await _service.GetAsync(request.Id);
        trigger.Update(request.IsEnabled);

        await _service.UpdateAsync(trigger);

        return true;
    }
}