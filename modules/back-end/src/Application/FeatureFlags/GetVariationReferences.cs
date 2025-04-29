using Application.Bases;
using Application.Experiments;

namespace Application.FeatureFlags;

public class GetVariationReferences : IRequest<ICollection<ExperimentVm>>
{
    public Guid EnvId { get; set; }

    public Guid FlagId { get; set; }

    public string VariationId { get; set; }
}

public class GetVariationReferencesValidator : AbstractValidator<GetVariationReferences>
{
    public GetVariationReferencesValidator()
    {
        RuleFor(x => x.FlagId)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("featureFlagId"));

        RuleFor(x => x.VariationId)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("variationId"));
    }
}

public class GetVariationReferencesHandler(IExperimentService service)
    : IRequestHandler<GetVariationReferences, ICollection<ExperimentVm>>
{
    public async Task<ICollection<ExperimentVm>> Handle(GetVariationReferences request,
        CancellationToken cancellationToken)
    {
        var filter = new ExperimentFilter
        {
            FeatureFlagId = request.FlagId,
            // no pagination
            PageSize = -1
        };

        var experiments = await service.GetListAsync(request.EnvId, filter);

        return experiments.Items.Where(x => x.BaselineVariation.Id == request.VariationId).ToArray();
    }
}