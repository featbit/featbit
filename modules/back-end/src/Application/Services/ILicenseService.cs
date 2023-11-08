namespace Application.Services;

public interface ILicenseService
{
    /// <summary>
    /// Check if the feature is granted for the organization
    /// </summary>
    Task<bool> IsFeatureGrantedAsync(string feature, Guid orgId);
    
    /// <summary>
    /// Check if the feature is granted for the organization
    /// </summary>
    bool IsFeatureGrantedAsync(string feature, Guid workSpaceId, string licenseString);
}