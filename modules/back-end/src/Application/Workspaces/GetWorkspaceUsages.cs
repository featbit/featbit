using System.Text.Json;
using Domain.Workspaces;

namespace Application.Workspaces;

public class GetWorkspaceUsages : IRequest<object>
{
    public Guid WorkspaceId { get; set; }
}

public class GetWorkspaceUsageHandler(IWorkspaceService service) : IRequestHandler<GetWorkspaceUsages, object>
{
    public async Task<object> Handle(GetWorkspaceUsages request, CancellationToken cancellationToken)
    {
        var workspace = await service.GetAsync(request.WorkspaceId);
        var isLicenseValid = LicenseVerifier.TryParse(request.WorkspaceId, workspace.License, out var license);

        var dic = new Dictionary<string, object>();

        foreach (var feature in LicenseFeatures.UsageFeatures)
        {
            var quota = GetQuota(feature);
            var used = await CountUsageAsync(feature);
            dic[feature] = new { quota, used };
        }

        return dic;

        int GetQuota(string feature)
        {
            var defaultQuota = Workspace.DefaultQuotas.GetValueOrDefault(feature, 0);

            var licenseString = workspace.License;
            if (string.IsNullOrWhiteSpace(licenseString))
            {
                return defaultQuota;
            }

            if (!isLicenseValid)
            {
                // return 0 for invalid license
                return 0;
            }

            var metadata = license.Metadata;
            if (metadata == null)
            {
                // compatible with existing license without metadata
                return defaultQuota;
            }

            // return 0 for malformed metadata
            var metadataValue = metadata.Value;
            if (metadataValue.ValueKind is not JsonValueKind.Object)
            {
                return 0;
            }

            var propertyName = feature switch
            {
                LicenseFeatures.AutoAgents => "autoAgent",
                _ => throw new InvalidOperationException($"Not a usage feature '{feature}'"),
            };

            if (!metadataValue.TryGetProperty(propertyName, out var autoAgentsProperty) ||
                !autoAgentsProperty.TryGetProperty("limit", out var limitProperty) ||
                limitProperty.ValueKind != JsonValueKind.Number)
            {
                return 0;
            }

            return limitProperty.GetInt32();
        }

        async Task<int> CountUsageAsync(string feature)
        {
            return feature switch
            {
                LicenseFeatures.AutoAgents => await service.GetUsageAsync(request.WorkspaceId, feature),
                _ => throw new InvalidOperationException($"Not a usage feature '{feature}'"),
            };
        }
    }
}