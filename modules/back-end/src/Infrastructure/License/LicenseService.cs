using Application.Caches;
using Domain.Workspaces;

namespace Infrastructure.License;

public class LicenseService : ILicenseService
{
    private readonly ICacheService _cacheService;

    public LicenseService(ICacheService cacheService)
    {
        _cacheService = cacheService;
    }

    public async Task<bool> IsFeatureGrantedAsync(string feature, Guid workSpaceId)
    {
        var licenseString = await _cacheService.GetLicenseAsync(workSpaceId);

        return await IsFeatureGrantedAsync(feature, workSpaceId, licenseString);
    }
    
    public async Task<bool> IsFeatureGrantedAsync(string feature, Guid workSpaceId, string licenseString)
    {
        if (!LicenseFeatures.IsDefined(feature))
        {
            return false;
        }
        
        var isGranted =
            LicenseVerifier.TryParse(workSpaceId, licenseString, out var license) &&
            license.IsGranted(feature);

        return isGranted;
    }
}