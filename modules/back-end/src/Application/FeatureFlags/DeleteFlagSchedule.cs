namespace Application.FeatureFlags;

public class DeleteFlagSchedule : IRequest<bool>
{
    public Guid ScheduleId { get; set; }
}

public class DeleteFlagScheduleHandler : IRequestHandler<DeleteFlagSchedule, bool>
{
    private readonly IFlagScheduleService _service;

    public DeleteFlagScheduleHandler(IFlagScheduleService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(DeleteFlagSchedule request, CancellationToken cancellationToken)
    {
        var schedule = await _service.GetAsync(request.ScheduleId);
        if (schedule == null)
        {
            return true;
        }

        await _service.DeleteAsync(schedule.Id);

        return true;
    }
}