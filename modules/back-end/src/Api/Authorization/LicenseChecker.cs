using Application.License;
using Application.Services;

namespace Api.Authorization;

public class LicenseChecker : ILicenseChecker
{
    private readonly ILicenseService _licenseService;

    public LicenseChecker(
        ILicenseService licenseService)
    {
        _licenseService = licenseService;
    }

    public async Task<bool> Verify(Guid orgId, string licenseFeature)
    {
        var licenseData = await _licenseService.VerifyLicenseAsync(orgId);
        
        if (licenseData == null)
        {
            return false;
        }

        return licenseFeature switch
        {
            LicenseFeatures.Sso => licenseData.IsGranted(LicenseFeatures.Sso),
            LicenseFeatures.Schedule => licenseData.IsGranted(LicenseFeatures.Schedule),
            _ => false
        };
    }
}