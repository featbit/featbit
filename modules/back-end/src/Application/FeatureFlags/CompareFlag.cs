using Application.Bases;
using Domain.FeatureFlags;

namespace Application.FeatureFlags;

public class CompareFlag : IRequest<FlagDiff>
{
    public string Key { get; set; }

    public Guid SourceEnvId { get; set; }

    public Guid TargetEnvId { get; set; }
}

public class CompareFlagValidator : AbstractValidator<CompareFlag>
{
    public CompareFlagValidator()
    {
        RuleFor(x => x.Key)
            .NotEmpty().WithErrorCode(ErrorCodes.Invalid("key"));
        RuleFor(x => x.SourceEnvId)
            .NotEmpty().WithErrorCode(ErrorCodes.Invalid("sourceEnvId"));
        RuleFor(x => x.TargetEnvId)
            .NotEmpty().WithErrorCode(ErrorCodes.Invalid("targetEnvId"));
    }
}

public class CompareFlagHandler(IFeatureFlagService service)
    : IRequestHandler<CompareFlag, FlagDiff>
{
    public async Task<FlagDiff> Handle(CompareFlag request, CancellationToken cancellationToken)
    {
        var sourceFlag = await service.GetAsync(request.SourceEnvId, request.Key);
        var targetFlag = await service.GetAsync(request.TargetEnvId, request.Key);

        var diff = FlagDiffer.Diff(sourceFlag, targetFlag);
        return diff;
    }
}