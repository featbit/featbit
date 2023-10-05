using Application.Services;

namespace Api.Authorization;

public class LicenseChecker : ILicenseChecker
{
    private readonly ILogger<DefaultPermissionChecker> _logger;
    private readonly ILicenseService _licenseService;

    public LicenseChecker(
        ILogger<DefaultPermissionChecker> logger,
        ILicenseService licenseService)
    {
        _logger = logger;
        _licenseService = licenseService;
    }

    public async Task<bool> Verify(Guid orgId, string licenseItem)
    {
        var licenseData = await _licenseService.VerifyLicenseAsync(orgId);
        
        if (licenseData == null)
        {
            _logger.LogWarning("The license is not valid.");
            return false;
        }

        return licenseItem switch
        {
            LicenseItems.Sso => licenseData.Sso,
            LicenseItems.Schedule => licenseData.Schedule,
            _ => false
        };
    }
}