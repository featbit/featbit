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

    public async Task<bool> IsFeatureGrantedAsync(Guid workspaceId, string feature)
    {
        if (!LicenseFeatures.IsDefined(feature))
        {
            return false;
        }

        var licenseString = await _cacheService.GetLicenseAsync(workspaceId);

        var isGranted =
            LicenseVerifier.TryParse(workspaceId, licenseString, out var license) &&
            license.IsGranted(feature);
        return isGranted;
    }
}