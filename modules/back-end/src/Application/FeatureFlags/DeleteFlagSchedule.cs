namespace Application.FeatureFlags;

public class DeleteFlagSchedule : IRequest<bool>
{
    public Guid ScheduleId { get; set; }
}

public class DeleteFlagScheduleHandler : IRequestHandler<DeleteFlagSchedule, bool>
{
    private readonly IFlagScheduleService _service;
    private readonly IFlagChangeRequestService _flagChangeRequestService;

    public DeleteFlagScheduleHandler(
        IFlagScheduleService service,
        IFlagChangeRequestService flagChangeRequestService)
    {
        _service = service;
        _flagChangeRequestService = flagChangeRequestService;
    }

    public async Task<bool> Handle(DeleteFlagSchedule request, CancellationToken cancellationToken)
    {
        var schedule = await _service.GetAsync(request.ScheduleId);
        if (schedule == null)
        {
            return true;
        }

        await _service.DeleteAsync(schedule.Id);

        if (!schedule.ChangeRequestId.HasValue)
        {
            return true;
        }
        
        var changeRequest = await _flagChangeRequestService.GetAsync(schedule.ChangeRequestId.Value);
        if (changeRequest != null)
        {
            await _flagChangeRequestService.DeleteAsync(changeRequest.Id);
        }

        return true;
    }
}