using Application.Caches;
using Domain.Organizations;

namespace Infrastructure.License;

public class LicenseService : ILicenseService
{
    private readonly ICacheService _cacheService;

    public LicenseService(ICacheService cacheService)
    {
        _cacheService = cacheService;
    }

    public async Task<bool> IsFeatureGrantedAsync(Guid orgId, string feature)
    {
        if (!LicenseFeatures.IsDefined(feature))
        {
            return false;
        }

        var licenseString = await _cacheService.GetLicenseAsync(orgId);
        var isGranted =
            LicenseVerifier.TryParse(orgId, licenseString, out var license) &&
            license.IsGranted(feature);

        return isGranted;
    }
}