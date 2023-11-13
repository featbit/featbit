using Application.Bases;
using Application.Bases.Exceptions;
using Application.FeatureFlags;
using Domain.AuditLogs;
using Domain.Triggers;
using Domain.Users;

namespace Application.Triggers;

public class RunTrigger : IRequest<bool>
{
    public string Token { get; set; }
}

public class RunTriggerHandler : IRequestHandler<RunTrigger, bool>
{
    private readonly ITriggerService _triggerService;
    private readonly IFeatureFlagService _flagService;
    private readonly IPublisher _publisher;

    public RunTriggerHandler(
        ITriggerService triggerService,
        IFeatureFlagService flagService,
        IPublisher publisher)
    {
        _triggerService = triggerService;
        _flagService = flagService;
        _publisher = publisher;
    }

    public async Task<bool> Handle(RunTrigger request, CancellationToken cancellationToken)
    {
        if (!Trigger.TryParseToken(request.Token, out var id))
        {
            throw new BusinessException(ErrorCodes.InvalidTriggerToken);
        }

        var trigger = await _triggerService.FindOneAsync(x => x.Id == id && x.Token == request.Token);
        if (trigger == null)
        {
            throw new BusinessException(ErrorCodes.TriggerTokenNotMatchOrHasExpired);
        }

        // feature flag general trigger
        if (trigger.Type == TriggerTypes.FfGeneral)
        {
            var flag = await _flagService.GetAsync(trigger.TargetId);

            var dataChange = trigger.Run(flag);
            if (dataChange == null)
            {
                return true;
            }

            await _flagService.UpdateAsync(flag);
            await _triggerService.UpdateAsync(trigger);

            // publish on feature flag change notification
            var comment = trigger.Action == TriggerActions.TurnOff ? "Turn off by trigger" : "Turn on by trigger";
            var notification =
                new OnFeatureFlagChanged(flag, Operations.Update, dataChange, SystemUser.Id, comment);
            await _publisher.Publish(notification, cancellationToken);
        }

        return true;
    }
}