namespace Application.Services;

public interface ILicenseService
{
    /// <summary>
    /// Check if the feature is granted for the organization
    /// </summary>
    Task<bool> IsFeatureGrantedAsync(Guid orgId, string feature);
}