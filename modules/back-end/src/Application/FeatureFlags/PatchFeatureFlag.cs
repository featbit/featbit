using Microsoft.AspNetCore.JsonPatch;
using Microsoft.AspNetCore.JsonPatch.Operations;
using Newtonsoft.Json.Serialization;

namespace Application.FeatureFlags;

public class PatchFeatureFlag : IRequest<PatchResult>
{
    public Guid EnvId { get; set; }

    public string Key { get; set; }

    public List<Operation> Operations { get; set; }
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
        var patch = new JsonPatchDocument(request.Operations, new DefaultContractResolver());
        patch.ApplyTo(flag, jsonPatchError => error = jsonPatchError.ErrorMessage);

        if (!string.IsNullOrWhiteSpace(error))
        {
            return PatchResult.Fail(error);
        }

        await _service.UpdateAsync(flag);
        return PatchResult.Ok();
    }
}