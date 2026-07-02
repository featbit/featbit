using Application.Bases;
using Domain.ExperimentMetrics;

namespace Application.ExperimentMetrics;

public class UpdateExperimentMetric : IRequest<ExperimentMetricVm>
{
    public Guid Id { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    public Guid MaintainerUserId { get; set; }
    public string EventName { get; set; }
    public EventType EventType { get; set; }
    public CustomEventTrackOption CustomEventTrackOption { get; set; }
    public string CustomEventUnit { get; set; }
    public CustomEventSuccessCriteria CustomEventSuccessCriteria { get; set; }
    public string ElementTargets { get; set; }
    public List<TargetUrl> TargetUrls { get; set; }
}

public class UpdateExperimentMetricValidator : AbstractValidator<UpdateExperimentMetric>
{
    public UpdateExperimentMetricValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("name"));
        RuleFor(x => x.EventName)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("eventName"));
        RuleFor(x => x.EventType)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("eventType"));
        RuleFor(x => x.MaintainerUserId)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("maintainerUserId"));
    }
}

public class UpdateExperimentMetricHandler : IRequestHandler<UpdateExperimentMetric, ExperimentMetricVm>
{
    private readonly IExperimentMetricService _service;
    private readonly IUserService _userService;
    private readonly IMapper _mapper;

    public UpdateExperimentMetricHandler(
        IExperimentMetricService service,
        IUserService userService,
        IMapper mapper)
    {
        _service = service;
        _userService = userService;
        _mapper = mapper;
    }

    public async Task<ExperimentMetricVm> Handle(UpdateExperimentMetric request, CancellationToken cancellationToken)
    {
        var em = await _service.GetAsync(request.Id);
        em.UpdatedAt = DateTime.UtcNow;
        em.Description = request.Description;
        em.EventName = request.EventName;
        em.EventType = request.EventType;
        em.MaintainerUserId = request.MaintainerUserId;
        em.CustomEventSuccessCriteria = request.CustomEventSuccessCriteria;
        em.CustomEventUnit = request.CustomEventUnit;
        em.CustomEventTrackOption = request.CustomEventTrackOption;
        em.ElementTargets = request.ElementTargets;
        em.TargetUrls = request.TargetUrls;
        em.Name = request.Name;
        await _service.UpdateAsync(em);

        var user = await _userService.GetAsync(em.MaintainerUserId);
        var metricVm = _mapper.Map<ExperimentMetricVm>(em);
        metricVm.MaintainerEmail = user.Email;
        metricVm.MaintainerName = user.Name;

        return metricVm;
    }
}