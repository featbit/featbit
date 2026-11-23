using System.Text.Json;
using System.Text.Json.Serialization;
using Application.Bases;

namespace Application.ReleaseMetricSourceConnections;

public class ReleaseMetricSourceConnectionBase
{
    [JsonIgnore]
    public Guid OrgId { get; set; }

    [JsonIgnore]
    public Guid EnvId { get; set; }

    public string Name { get; set; }
    public string ProviderType { get; set; }
    public JsonElement ProviderConfig { get; set; }
    public JsonElement Authentication { get; set; }
}

public class ReleaseMetricSourceConnectionBaseValidator : AbstractValidator<ReleaseMetricSourceConnectionBase>
{
    private const string Prometheus = "prometheus-compatible";
    private const string AzureMonitor = "azure-monitor";

    public ReleaseMetricSourceConnectionBaseValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("name"))
            .MaximumLength(256).WithErrorCode(ErrorCodes.Invalid("name"))
            .Must(name => name?.Any(char.IsControl) != true).WithErrorCode(ErrorCodes.Invalid("name"));

        RuleFor(x => x.ProviderType)
            .Must(type => type is Prometheus or AzureMonitor)
            .WithErrorCode(ErrorCodes.Invalid("providerType"));

        When(x => x.ProviderType == Prometheus, () =>
        {
            RuleFor(x => x.ProviderConfig)
                .Must(config => HasOnlyPublicFields(config, "endpoint"))
                .WithErrorCode(ErrorCodes.Invalid("providerConfig"));
            RuleFor(x => x.Authentication)
                .Must(auth => HasOnlyPublicFields(auth, "type", "username"))
                .WithErrorCode(ErrorCodes.Invalid("authentication"));
        });

        When(x => x.ProviderType == AzureMonitor, () =>
        {
            RuleFor(x => x.ProviderConfig)
                .Must(config => HasOnlyPublicFields(config, "workspaceId"))
                .WithErrorCode(ErrorCodes.Invalid("providerConfig"));
            RuleFor(x => x.Authentication)
                .Must(auth => HasOnlyPublicFields(auth, "mode", "tenantId", "clientId"))
                .WithErrorCode(ErrorCodes.Invalid("authentication"));
        });
    }

    private static bool HasOnlyPublicFields(JsonElement settings, params string[] publicFields)
    {
        if (settings.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        var remainingFields = publicFields.ToHashSet(StringComparer.Ordinal);
        foreach (var field in settings.EnumerateObject())
        {
            if (!remainingFields.Remove(field.Name) || field.Value.ValueKind is JsonValueKind.Object or JsonValueKind.Array)
            {
                return false;
            }

            if (field.NameEquals("endpoint") && field.Value.ValueKind == JsonValueKind.String &&
                !IsPublicEndpoint(field.Value.GetString()))
            {
                return false;
            }
        }

        return true;
    }

    private static bool IsPublicEndpoint(string endpoint)
    {
        // User info, query strings and fragments can expose credentials in API responses.
        if (endpoint.Contains('?') || endpoint.Contains('#'))
        {
            return false;
        }

        return !endpoint.Contains('@') ||
            (Uri.TryCreate(endpoint, UriKind.Absolute, out var uri) && uri.Host.Length > 0 && uri.UserInfo.Length == 0);
    }
}
