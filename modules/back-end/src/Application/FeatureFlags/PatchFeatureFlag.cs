using Application.Bases;
using Microsoft.AspNetCore.JsonPatch;

namespace Application.FeatureFlags;

public class PatchFeatureFlag : IRequest<PatchResult>
{
    public Guid EnvId { get; set; }

    public string Key { get; set; }

    public JsonPatchDocument Operations { get; set; }
}

public class PatchFeatureFlagValidator : AbstractValidator<PatchFeatureFlag>
{
    public PatchFeatureFlagValidator()
    {
        RuleFor(x => x.Operations)
            .NotEmpty().WithErrorCode(ErrorCodes.OperationsAreRequired);
    }
}

public class PatchFeatureFlagHandler : IRequestHandler<PatchFeatureFlag, PatchResult>
{
    private readonly IFeatureFlagService _service;
    private readonly IMapper _mapper;

    public PatchFeatureFlagHandler(IFeatureFlagService service, IMapper mapper)
    {
        _service = service;
        _mapper = mapper;
    }

    public async Task<PatchResult> Handle(PatchFeatureFlag request, CancellationToken cancellationToken)
    {
        var result = new PatchResult();
        var flag = await _service.GetAsync(request.EnvId, request.Key);

        request.Operations.ApplyTo(flag, x =>
        {
            result.Success = false;
            result.Message = x.ErrorMessage;
        });

        if (result.Success)
        {
            await _service.UpdateAsync(flag);
        }

        return result;
    }
}