using Application.Services;
using Domain.Resources;

namespace Api.Authorization;

public class ResourceNameService : IResourceNameService
{
    private readonly IFeatureFlagService _featureFlagService;
    
    public ResourceNameService(
        IFeatureFlagService featureFlagService)
    {
        _featureFlagService = featureFlagService;
    }

    public async Task<string> GetRnAsync(string resourceType, HttpContext context)
    {
        // Get resource parameter name from attribute
        var endpoint = context.GetEndpoint();
        var resourceParameterAttr = endpoint?.Metadata.GetMetadata<ResourceParameterAttribute>();
        
        string? resourceId = null;
        if (resourceParameterAttr != null)
        {
            var routeValues = context.Request.RouteValues;
            if (routeValues.TryGetValue(resourceParameterAttr.ParameterName, out var value))
            {
                resourceId = value?.ToString();
            }
        }
        else
        {
            // Fallback to default parameter name "id"
            var routeValues = context.Request.RouteValues;
            routeValues.TryGetValue("id", out var value);
            resourceId = value?.ToString();
        }

        // If no resource ID found, return resource type RN
        if (string.IsNullOrEmpty(resourceId) || !Guid.TryParse(resourceId, out var id))
        {
            return ResourceHelper.GetRn(resourceType);
        }

        // Get resource entity and build RN based on resource type
        return resourceType switch
        {
            ResourceTypes.FeatureFlag => await GetFeatureFlagRnAsync(id),
            ResourceTypes.Segment => await GetSegmentRnAsync(id),
            // Add other resource types as needed
            _ => ResourceHelper.GetRn(resourceType, resourceId)
        };
    }

    private async Task<string> GetFeatureFlagRnAsync(Guid envId, string key)
    {
        var flag = await _featureFlagService.GetAsync(envId, key);
        if (flag == null)
        {
            return ResourceHelper.GetRn(ResourceTypes.FeatureFlag);
        }

        // Build RN with flag details (e.g., workspace, environment, flag key)
        return ResourceHelper.GetRn(
            ResourceTypes.FeatureFlag,
            flag.WorkspaceId.ToString(),
            flag.EnvId.ToString(),
            flag.Key
        );
    }

    private async Task<string> GetSegmentRnAsync(Guid id)
    {
        var segment = await _segmentService.GetAsync(id);
        if (segment == null)
        {
            return ResourceHelper.GetRn(ResourceTypes.Segment);
        }

        // Build RN with segment details
        return ResourceHelper.GetRn(
            ResourceTypes.Segment,
            segment.WorkspaceId.ToString(),
            segment.EnvId.ToString(),
            segment.Key
        );
    }
}