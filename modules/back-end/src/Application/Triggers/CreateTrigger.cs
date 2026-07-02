using Application.Bases;
using Domain.Triggers;

namespace Application.Triggers;

public class CreateTrigger : IRequest<Trigger>
{
    public Guid TargetId { get; set; }

    public string Type { get; set; }

    public string Action { get; set; }

    public string Description { get; set; }
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

    public CreateTriggerHandler(ITriggerService service)
    {
        _service = service;
    }

    public async Task<Trigger> Handle(CreateTrigger request, CancellationToken cancellationToken)
    {
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