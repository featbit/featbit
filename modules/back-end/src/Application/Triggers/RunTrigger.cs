using Application.Bases;
using Application.Bases.Exceptions;
using Domain.Triggers;

namespace Application.Triggers;

public class RunTrigger : IRequest<bool>
{
    public string Token { get; set; }
}

public class RunTriggerHandler : IRequestHandler<RunTrigger, bool>
{
    private readonly ITriggerService _triggerService;
    private readonly IFeatureFlagService _flagService;

    public RunTriggerHandler(
        ITriggerService triggerService,
        IFeatureFlagService flagService)
    {
        _triggerService = triggerService;
        _flagService = flagService;
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
            var featureFlag = await _flagService.GetAsync(trigger.TargetId);
            trigger.Run(featureFlag);
            await _flagService.UpdateAsync(featureFlag);
        }

        await _triggerService.UpdateAsync(trigger);

        return true;
    }
}