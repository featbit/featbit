using Application.Users;

namespace Application.FeatureFlags;

public class ApproveFlagChangeRequest : IRequest<bool>
{
    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

    public Guid Id { get; set; }
}

public class ApproveFlagChangeRequestHandler : IRequestHandler<ApproveFlagChangeRequest, bool>
{
    private readonly IFlagChangeRequestService _flagChangeRequestService;
    private readonly IFlagScheduleService _flagScheduleService;
    private readonly ICurrentUser _currentUser;

    public ApproveFlagChangeRequestHandler(
        IFlagChangeRequestService flagChangeRequestService,
        IFlagScheduleService flagScheduleService,
        ICurrentUser currentUser)
    {
        _flagChangeRequestService = flagChangeRequestService;
        _flagScheduleService = flagScheduleService;
        _currentUser = currentUser;
    }

    public async Task<bool> Handle(ApproveFlagChangeRequest request, CancellationToken cancellationToken)
    {
        var changeRequest = await _flagChangeRequestService.FindOneAsync(
            x => x.OrgId == request.OrgId && x.EnvId == request.EnvId && x.Id == request.Id
        );
        if (changeRequest == null || !changeRequest.CanBeApprovedBy(_currentUser.Id))
        {
            return false;
        }

        changeRequest.Approve(_currentUser.Id);
        await _flagChangeRequestService.UpdateAsync(changeRequest);

        // update schedule status if exists
        if (changeRequest.ScheduleId.HasValue)
        {
            var schedule = await _flagScheduleService.GetAsync(changeRequest.ScheduleId.Value);
            schedule.PendingExecution(_currentUser.Id);
            await _flagScheduleService.UpdateAsync(schedule);
        }

        return true;
    }
}