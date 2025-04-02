using Application.Bases;
using Application.Experiments;

namespace Application.FeatureFlags;

public class GetFeatureFlagVariationExptReferences : IRequest<ICollection<ExperimentVm>>
{
    public Guid EnvId { get; set; }

    public Guid FeatureFlagId { get; set; }

    public string VariationId { get; set; }
}

public class IsFeatureFlagVariationValidator : AbstractValidator<GetFeatureFlagVariationExptReferences>
{
    public IsFeatureFlagVariationValidator()
    {
        RuleFor(x => x.FeatureFlagId)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("featureFlagId"));

        RuleFor(x => x.VariationId)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("variationId"));
    }
}

public class IsFeatureFlagVariationUsedHandler : IRequestHandler<GetFeatureFlagVariationExptReferences, ICollection<ExperimentVm>>
{
    private readonly IExperimentService _service;

    public IsFeatureFlagVariationUsedHandler(IExperimentService service)
    {
        _service = service;
    }

    public async Task<ICollection<ExperimentVm>> Handle(GetFeatureFlagVariationExptReferences request, CancellationToken cancellationToken)
    {
        // No pagination
        var experiments = await _service.GetListAsync(request.EnvId, new ExperimentFilter { FeatureFlagId = request.FeatureFlagId, PageSize = -1 });
        return experiments.Items.Where(x => x.BaselineVariation.Id == request.VariationId).ToArray();
    }
}