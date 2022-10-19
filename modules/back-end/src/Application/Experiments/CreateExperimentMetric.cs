using Application.Bases;
using Application.Users;
using Domain.Experiments;

namespace Application.Experiments;

public class CreateExperimentMetric : IRequest<ExperimentMetric>
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
            .NotEmpty().WithErrorCode(ErrorCodes.NameIsRequired);
    }
}

public class CreateExperimentMetricHandler : IRequestHandler<CreateExperimentMetric, ExperimentMetric>
{
    private readonly ICurrentUser _currentUser;
    private readonly IExperimentMetricService _service;
    private readonly IMapper _mapper;

    public CreateExperimentMetricHandler(IExperimentMetricService service, ICurrentUser currentUser)
    {
        _service = service;
        _currentUser = currentUser;
    }

    public async Task<ExperimentMetric> Handle(CreateExperimentMetric request, CancellationToken cancellationToken)
    {
        var em = new ExperimentMetric()
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
        await _service.AddOneAsync(em);

        return em;
    }
}