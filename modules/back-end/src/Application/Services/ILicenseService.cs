namespace Application.Services;

public interface ILicenseService
{
    /// <summary>
    /// Check if the feature is granted for the workspace
    /// </summary>
    Task<bool> IsFeatureGrantedAsync(Guid workspaceId, string feature);
}