using Application.Users;
using Domain.FeatureFlags;
using Domain.FlagDrafts;
using Domain.FlagSchedules;
using Domain.Targeting;

namespace Application.FeatureFlags;

public class CreateFlagSchedule: IRequest<bool>
{
    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

    public string Key { get; set; }
    
    public FlagTargeting Targeting { get; set; }

    public string Title { get; set; }

    public DateTime ScheduledTime { get; set; }

    public Guid ChangeRequestId { get; set; }
}

public class CreateFlagScheduleHandler : IRequestHandler<CreateFlagSchedule, bool>
{
    private readonly IFeatureFlagService _flagService;
    private readonly IFlagScheduleService _flagScheduleService;
    private readonly IFlagDraftService _flagDraftService;
    private readonly ICurrentUser _currentUser;

    public CreateFlagScheduleHandler(
        IFeatureFlagService flagService,
        IFlagScheduleService flagScheduleService,
        IFlagDraftService flagDraftService,
        ICurrentUser currentUser)
    {
        _flagService = flagService;
        _flagScheduleService = flagScheduleService;
        _flagDraftService = flagDraftService;
        _currentUser = currentUser;
    }

    public async Task<bool> Handle(CreateFlagSchedule request, CancellationToken cancellationToken)
    {
        var flag = await _flagService.GetAsync(request.EnvId, request.Key);
        var dataChange = flag.UpdateTargeting(
            request.Targeting.TargetUsers,
            request.Targeting.Rules,
            request.Targeting.Fallthrough,
            request.Targeting.ExptIncludeAllTargets,
            _currentUser.Id
        );

        // create draft
        var flagDraft = FlagDraft.Pending(request.EnvId, flag.Id, string.Empty, dataChange, _currentUser.Id);
        await _flagDraftService.AddOneAsync(flagDraft);

        // create schedule
        var flagSchedule = FlagSchedule.WaitingForExecution(
            request.OrgId,
            request.EnvId,
            flagDraft.Id,
            flag.Id,
            request.Title,
            request.ScheduledTime,
            _currentUser.Id,
            request.ChangeRequestId
        );
        
        await _flagScheduleService.AddOneAsync(flagSchedule);

        return true;
    }
}