using Application.Bases;
using Domain.ExperimentMetrics;

namespace Application.ExperimentMetrics;

public class CreateExperimentMetric : IRequest<ExperimentMetricVm>
{
    public Guid EnvId { get; set; }
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

    public bool IsArvhived { get; set; }
}

public class CreateExperimentMetricValidator : AbstractValidator<CreateExperimentMetric>
{
    public CreateExperimentMetricValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("name"));
        RuleFor(x => x.EventType)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("eventType"));
        RuleFor(x => x.MaintainerUserId)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("maintainerUserId"));
    }
}

public class CreateExperimentMetricHandler : IRequestHandler<CreateExperimentMetric, ExperimentMetricVm>
{
    private readonly IExperimentMetricService _service;
    private readonly IUserService _userService;
    private readonly IMapper _mapper;

    public CreateExperimentMetricHandler(IExperimentMetricService service,
        IUserService userService,
        IMapper mapper)
    {
        _service = service;
        _userService = userService;
        _mapper = mapper;
    }

    public async Task<ExperimentMetricVm> Handle(CreateExperimentMetric request, CancellationToken cancellationToken)
    {
        var metric = new ExperimentMetric()
        {
            CreatedAt = DateTime.UtcNow,
            CustomEventSuccessCriteria = request.CustomEventSuccessCriteria,
            CustomEventTrackOption = request.CustomEventTrackOption,
            CustomEventUnit = request.CustomEventUnit,
            Description = request.Description,
            ElementTargets = request.ElementTargets,
            EnvId = request.EnvId,
            EventName = request.EventName,
            EventType = request.EventType,
            IsArvhived = request.IsArvhived,
            MaintainerUserId = request.MaintainerUserId,
            Name = request.Name,
            TargetUrls = request.TargetUrls,
            UpdatedAt = DateTime.UtcNow
        };
        await _service.AddOneAsync(metric);


        var user = await _userService.GetAsync(metric.MaintainerUserId);
        var metricVm = _mapper.Map<ExperimentMetricVm>(metric);
        metricVm.MaintainerEmail = user.Email;
        metricVm.MaintainerName = user.Name;

        return metricVm;
    }
}