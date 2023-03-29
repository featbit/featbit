using Microsoft.AspNetCore.JsonPatch;

namespace Application.FeatureFlags;

public class PatchFeatureFlag : IRequest<PatchResult>
{
    public Guid EnvId { get; set; }

    public string Key { get; set; }

    public JsonPatchDocument Patch { get; set; }
}

public class PatchFeatureFlagHandler : IRequestHandler<PatchFeatureFlag, PatchResult>
{
    private readonly IFeatureFlagService _service;

    public PatchFeatureFlagHandler(IFeatureFlagService service)
    {
        _service = service;
    }

    public async Task<PatchResult> Handle(PatchFeatureFlag request, CancellationToken cancellationToken)
    {
        var flag = await _service.GetAsync(request.EnvId, request.Key);

        var error = string.Empty;
        request.Patch.ApplyTo(flag, jsonPatchError => error = jsonPatchError.ErrorMessage);

        if (!string.IsNullOrWhiteSpace(error))
        {
            return PatchResult.Fail(error);
        }

        await _service.UpdateAsync(flag);
        return PatchResult.Ok();
    }
}