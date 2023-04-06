using Application.Users;
using Microsoft.AspNetCore.JsonPatch;
using Domain.AuditLogs;

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
    private readonly IPublisher _publisher;
    
    public PatchFeatureFlagHandler(
        IFeatureFlagService service,
        IPublisher publisher)
    {
        _service = service;
        _publisher = publisher;
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
        
        // publish on feature flag change notification
        await _publisher.Publish(new OnFeatureFlagChanged(flag), cancellationToken);
        
        return PatchResult.Ok();
    }
}