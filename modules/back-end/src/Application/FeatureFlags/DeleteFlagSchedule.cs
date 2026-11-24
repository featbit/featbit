namespace Application.FeatureFlags;

public class DeleteFlagSchedule : IRequest<bool>
{
    public Guid Id { get; set; }
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
        await _service.DeleteAsync(request.Id);

        return true;
    }
}