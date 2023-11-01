using Application.Users;

namespace Application.FeatureFlags;

public class DeclineFlagChangeRequest : IRequest<bool>
{
    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

    public Guid Id { get; set; }
}

public class DeclineFlagChangeRequestHandler : IRequestHandler<DeclineFlagChangeRequest, bool>
{
    private readonly IFlagChangeRequestService _flagChangeRequestService;
    private readonly IFlagScheduleService _flagScheduleService;
    private readonly ICurrentUser _currentUser;

    public DeclineFlagChangeRequestHandler(
        IFlagChangeRequestService flagChangeRequestService,
        IFlagScheduleService flagScheduleService,
        ICurrentUser currentUser)
    {
        _flagChangeRequestService = flagChangeRequestService;
        _flagScheduleService = flagScheduleService;
        _currentUser = currentUser;
    }

    public async Task<bool> Handle(DeclineFlagChangeRequest request, CancellationToken cancellationToken)
    {
        var changeRequest = await _flagChangeRequestService.FindOneAsync(
            x => x.OrgId == request.OrgId && x.EnvId == request.EnvId && x.Id == request.Id
        );

        // check if change request can be declined by current user
        if (changeRequest?.CanBeDeclinedBy(_currentUser.Id) != true)
        {
            return false;
        }

        changeRequest.Decline(_currentUser.Id);
        await _flagChangeRequestService.UpdateAsync(changeRequest);

        // update schedule status if change request is attached to a schedule
        if (changeRequest.ScheduleId.HasValue)
        {
            var schedule = await _flagScheduleService.GetAsync(changeRequest.ScheduleId.Value);
            schedule.Decline(_currentUser.Id);
            await _flagScheduleService.UpdateAsync(schedule);
        }

        return true;
    }
}