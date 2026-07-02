using Application.Caches;
using Domain.Workspaces;

namespace Infrastructure.Services;

public class LicenseService : ILicenseService
{
    private readonly IWorkspaceService _workspaceService;
    private readonly ICacheService _cacheService;

    public LicenseService(IWorkspaceService workspaceService, ICacheService cacheService)
    {
        _workspaceService = workspaceService;
        _cacheService = cacheService;
    }

    public async Task<bool> IsFeatureGrantedAsync(Guid workspaceId, string feature)
    {
        if (!LicenseFeatures.IsDefined(feature))
        {
            return false;
        }

        var licenseString = await _cacheService.GetOrSetLicenseAsync(workspaceId, GetLicenseFromDb);

        var isGranted =
            LicenseVerifier.TryParse(workspaceId, licenseString, out var license) &&
            license.IsGranted(feature);
        return isGranted;

        async Task<string> GetLicenseFromDb()
        {
            var workspace = await _workspaceService.GetAsync(workspaceId);

            return workspace.License ?? string.Empty;
        }
    }
}