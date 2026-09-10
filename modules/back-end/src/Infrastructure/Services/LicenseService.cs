using Application.Caches;
using Domain.Observability;
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
        var metrics = AuthMetrics.Current;

        if (!LicenseFeatures.IsDefined(feature))
        {
            // The feature name is deliberately not tagged here: it did not resolve to a known
            // feature, so it is effectively free text as far as this metric is concerned.
            metrics.RecordLicenseCheck(
                AuthMethods.Unknown, Outcomes.Rejected, AuthReasons.UndefinedFeature);
            return false;
        }

        var licenseString = await _cacheService.GetOrSetLicenseAsync(workspaceId, GetLicenseFromDb);

        var isGranted =
            LicenseVerifier.TryParse(workspaceId, licenseString, out var license) &&
            license.IsGranted(feature);

        metrics.RecordLicenseCheck(
            feature,
            isGranted ? Outcomes.Success : Outcomes.Rejected,
            isGranted ? AuthReasons.Granted : AuthReasons.NotLicensed);

        return isGranted;

        async Task<string> GetLicenseFromDb()
        {
            var workspace = await _workspaceService.GetAsync(workspaceId);

            return workspace.License ?? string.Empty;
        }
    }
}