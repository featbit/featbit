using System.Text.Json;

namespace Domain.Workspaces;

public class Workspace
{
    public Guid Id { get; set; }

    public string? License { get; set; }

    public int GetAutoAgentQuota()
    {
        if (string.IsNullOrWhiteSpace(License))
        {
            return WorkspaceConstants.DefaultAllowedAutoAgents;
        }

        var isValid = LicenseVerifier.TryParse(Id, License, out var license);
        if (!isValid)
        {
            return 0;
        }

        var metadata = license.Metadata;
        if (metadata == null)
        {
            // compatible with existing license without metadata
            return WorkspaceConstants.DefaultAllowedAutoAgents;
        }

        // return 0 for malformed metadata
        var metadataValue = metadata.Value;
        if (metadataValue.ValueKind is not JsonValueKind.Object)
        {
            return 0;
        }

        if (!metadataValue.TryGetProperty("autoAgent", out var autoAgentsProperty) ||
            !autoAgentsProperty.TryGetProperty("limit", out var limitProperty) ||
            limitProperty.ValueKind != JsonValueKind.Number)
        {
            return 0;
        }

        return limitProperty.GetInt32();
    }
}