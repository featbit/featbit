using System.Text.Json;
using Application.Bases;
using Application.Bases.Exceptions;
using Domain.ObservabilityProviders;

namespace Application.ObservabilityProviders;

public sealed class PreparedProviderConfiguration(ProviderConnectionConfiguration connectionConfiguration, string protectedCredential)
{
    public ProviderConnectionConfiguration ConnectionConfiguration { get; } = connectionConfiguration;
    public string ProtectedCredential { get; } = protectedCredential;
}

public static class ProviderConfiguration
{
    public const string Prometheus = "prometheus-compatible";
    public const string AzureMonitor = "azure-monitor";

    public static PreparedProviderConfiguration Prepare(
        ObservabilityProviderRequest request,
        Guid envId,
        Guid id,
        IProviderCredentialProtector protector,
        ObservabilityProvider previous = null)
    {
        if (request.ProviderSchemaVersion != 1) throw Invalid("providerSchemaVersion");
        var (config, identity, secretField) = request.ProviderType switch
        {
            Prometheus => ReadPrometheus(request.ProviderConfig, request.Authentication),
            AzureMonitor => ReadAzureMonitor(request.ProviderConfig, request.Authentication),
            _ => throw Invalid("providerType")
        };

        var update = request.SecretUpdate;
        string credential = null;
        DateTime? rotatedAt = null;
        if (secretField == null)
        {
            if (previous?.ProtectedCredential != null || update.ValueKind is not (JsonValueKind.Null or JsonValueKind.Undefined))
            {
                Fields(update, "secretUpdate", "operation");
                if (Text(update, "operation") != "remove") throw Invalid("secretUpdate");
            }
        }
        else
        {
            var context = CredentialContext(request, envId, id, config, identity);
            switch (Text(update, "operation"))
            {
                case "keep":
                    Fields(update, "secretUpdate", "operation");
                    if (previous?.ProtectedCredential == null || previous.ProviderType != request.ProviderType ||
                        !CanKeepCredential(previous, config, identity))
                    {
                        throw Invalid("secretUpdate");
                    }
                    var old = previous.ConnectionConfiguration;
                    var oldContext = CredentialContext(request, envId, id, old.ProviderConfig, AuthenticationIdentity(old.Authentication));
                    var secret = protector.Unprotect(previous.ProtectedCredential, oldContext);
                    credential = protector.Protect(secret, context);
                    rotatedAt = old.Authentication.GetProperty("lastRotatedAt").GetDateTime();
                    break;
                case "replace":
                    Fields(update, "secretUpdate", "operation", secretField);
                    var replacement = Text(update, secretField, 8192);
                    if (secretField == "token" && replacement.Any(c => !char.IsAscii(c) || char.IsWhiteSpace(c)))
                    {
                        throw Invalid("token");
                    }
                    credential = protector.Protect(replacement, context);
                    rotatedAt = DateTime.UtcNow;
                    break;
                default:
                    throw Invalid("secretUpdate");
            }
        }

        var authentication = new Dictionary<string, object>();
        foreach (var (field, value) in identity) authentication.Add(field, value);
        authentication.Add("secretState", credential == null ? "not_configured" : "configured");
        authentication.Add("lastRotatedAt", rotatedAt);
        return new(new(config, JsonSerializer.SerializeToElement(authentication)), credential);
    }

    public static bool HasSameIdentity(ProviderConnectionConfiguration first, ProviderConnectionConfiguration second) =>
        JsonElement.DeepEquals(first.ProviderConfig, second.ProviderConfig) &&
        AuthenticationIdentity(first.Authentication).SequenceEqual(AuthenticationIdentity(second.Authentication));

    private static (JsonElement Config, Dictionary<string, string> Identity, string SecretField) ReadPrometheus(
        JsonElement config, JsonElement authentication)
    {
        Fields(config, "providerConfig", "endpoint");
        var endpoint = Text(config, "endpoint");
        if (!Uri.TryCreate(endpoint, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps ||
            string.IsNullOrEmpty(uri.Host) || uri.UserInfo.Length != 0 || uri.Query.Length != 0 || uri.Fragment.Length != 0)
        {
            throw Invalid("endpoint");
        }

        var type = Text(authentication, "type");
        Dictionary<string, string> identity = new() { ["type"] = type };
        string secretField;
        switch (type)
        {
            case "none":
                Fields(authentication, "authentication", "type");
                secretField = null;
                break;
            case "bearer_token":
                Fields(authentication, "authentication", "type");
                secretField = "token";
                break;
            case "basic":
                Fields(authentication, "authentication", "type", "username");
                var username = Text(authentication, "username", 256);
                if (username.Contains(':')) throw Invalid("username");
                identity.Add("username", username);
                secretField = "password";
                break;
            default:
                throw Invalid("authentication");
        }

        var normalized = JsonSerializer.SerializeToElement(new { endpoint = uri.AbsoluteUri.TrimEnd('/') });
        return (normalized, identity, secretField);
    }

    private static (JsonElement Config, Dictionary<string, string> Identity, string SecretField) ReadAzureMonitor(
        JsonElement config, JsonElement authentication)
    {
        Fields(config, "providerConfig", "workspaceId");
        var workspaceId = GuidText(config, "workspaceId");
        Fields(authentication, "authentication", "mode", "tenantId", "clientId");
        var mode = Text(authentication, "mode");
        if (mode != "ClientSecret") throw Invalid("authentication");
        var identity = new Dictionary<string, string>
        {
            ["mode"] = mode,
            ["tenantId"] = GuidText(authentication, "tenantId"),
            ["clientId"] = GuidText(authentication, "clientId")
        };
        return (JsonSerializer.SerializeToElement(new { workspaceId }), identity, "clientSecret");
    }

    private static string GuidText(JsonElement value, string field)
    {
        if (!Guid.TryParseExact(Text(value, field), "D", out var guid) || guid == Guid.Empty) throw Invalid(field);
        return guid.ToString("D");
    }

    private static bool CanKeepCredential(ObservabilityProvider previous, JsonElement config, Dictionary<string, string> identity)
    {
        var authentication = previous.ConnectionConfiguration.Authentication;
        if (previous.ProviderType == Prometheus)
        {
            return JsonElement.DeepEquals(previous.ConnectionConfiguration.ProviderConfig, config) &&
                   Text(authentication, "type") == identity["type"];
        }
        // The application secret is specific to one Entra application and tenant.
        return identity.All(field => Text(authentication, field.Key) == field.Value);
    }

    // jsonb may reorder properties. Bind the secret to identity and destination in a stable order across stores.
    private static string CredentialContext(ObservabilityProviderRequest request, Guid envId, Guid id, JsonElement config, IDictionary<string, string> identity)
    {
        var destination = new SortedDictionary<string, string>(StringComparer.Ordinal);
        foreach (var property in config.EnumerateObject()) destination.Add(property.Name, property.Value.GetString());
        return JsonSerializer.Serialize(new
        {
            purpose = "featbit:observability-provider:credential:v1",
            request.OrgId, request.ProjectId, envId, id, request.ProviderType, request.ProviderSchemaVersion, destination,
            authentication = new SortedDictionary<string, string>(identity, StringComparer.Ordinal)
        });
    }

    private static SortedDictionary<string, string> AuthenticationIdentity(JsonElement authentication)
    {
        var identity = new SortedDictionary<string, string>(StringComparer.Ordinal);
        foreach (var property in authentication.EnumerateObject())
        {
            if (property.Name is not ("lastRotatedAt" or "secretState"))
                identity.Add(property.Name, property.Value.GetString());
        }
        return identity;
    }

    private static void Fields(JsonElement value, string field, params string[] allowed)
    {
        if (value.ValueKind != JsonValueKind.Object) throw Invalid(field);
        var remaining = new HashSet<string>(allowed, StringComparer.Ordinal);
        foreach (var property in value.EnumerateObject())
        {
            if (!remaining.Remove(property.Name)) throw Invalid(field);
        }
        if (remaining.Count != 0) throw Invalid(field);
    }

    private static string Text(JsonElement value, string field, int maxLength = 2048)
    {
        if (value.ValueKind != JsonValueKind.Object || !value.TryGetProperty(field, out var element) ||
            element.ValueKind != JsonValueKind.String)
            throw Invalid(field);
        var text = element.GetString();
        if (string.IsNullOrWhiteSpace(text) || text.Length > maxLength || text.Any(char.IsControl)) throw Invalid(field);
        return text;
    }

    private static BusinessException Invalid(string field) => new(ErrorCodes.Invalid(field));
}
