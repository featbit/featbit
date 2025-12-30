using Application.Bases;
using Domain.Resources;

namespace Application.FeatureFlags;

public class CompareFlag : IRequest<CompareFlagDetail>
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

public class CompareFlagHandler(IFeatureFlagService flagService, IResourceServiceV2 resourceService)
    : IRequestHandler<CompareFlag, CompareFlagDetail>
{
    public async Task<CompareFlagDetail> Handle(CompareFlag request, CancellationToken cancellationToken)
    {
        var sourceFlag = await flagService.GetAsync(request.SourceEnvId, request.Key);
        var targetFlag = await flagService.FindOneAsync(x => x.EnvId == request.TargetEnvId && x.Key == request.Key);
        if (targetFlag == null)
        {
            return null;
        }

        var targetEnvRN = await resourceService.GetRNAsync(request.TargetEnvId, ResourceTypes.Env);
        var relatedSegments = await flagService.GetRelatedSegmentsAsync([sourceFlag, targetFlag]);

        return new CompareFlagDetail(sourceFlag, targetFlag, relatedSegments, targetEnvRN);
    }
}