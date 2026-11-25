#nullable enable

using System.Text.Json;
using Application.Bases;
using Domain.Environments;
using Domain.ReleaseMetricSourceConnections;
using FluentValidation.Results;

namespace Application.ReleaseMetricSourceConnections;

internal static class ReleaseMetricSourceCredentialUpdate
{
    internal static (JsonElement? Replacement, bool Remove) Resolve(
        ReleaseMetricSourceConnectionBase request, ReleaseMetricSourceConnection? previous,
        ResourceDescriptor scope, IReleaseMetricSourceCredentialProtector protector)
    {
        var previousAuth = previous?.ProviderType == request.ProviderType ? previous?.ConnectionConfiguration.Authentication : null;

        // PR 1 accepted partially configured connections without credentials.
        if (request.SecretUpdate.ValueKind == JsonValueKind.Undefined && previousAuth.HasValue &&
            previous is { ProtectedCredential: null } && JsonElement.DeepEquals(previousAuth.Value, request.Authentication))
        {
            return (null, false);
        }

        var (operation, sameMethod, readReplacement) = request.ProviderType switch
        {
            "prometheus-compatible" => ReadPrometheus(request, previousAuth),
            "azure-monitor" => ReadAzureMonitor(request, previousAuth),
            _ => throw Invalid("providerType")
        };

        if (operation == "remove" && previous != null && (sameMethod || readReplacement == null))
        {
            return (null, true);
        }
        if (operation == null && previous?.ProtectedCredential == null && (sameMethod || readReplacement == null))
        {
            return (null, false);
        }

        // Only stable string identifiers and nulls can form the authenticated context across both databases.
        if (!HasOnlyStringsOrNulls(request.ProviderConfig))
        {
            throw Invalid("providerConfig");
        }
        if (!HasOnlyStringsOrNulls(request.Authentication))
        {
            throw Invalid("authentication");
        }

        if (operation == "replace" && readReplacement != null)
        {
            return (readReplacement(request.SecretUpdate), false);
        }

        if (operation is not (null or "keep") || !sameMethod || previous?.ProtectedCredential == null)
        {
            throw Invalid("secretUpdate");
        }

        var settings = previous.ConnectionConfiguration;
        if (request.ProviderType == "prometheus-compatible" &&
            !PrometheusConnectionEndpoint.HasSameOrigin(settings.ProviderConfig, request.ProviderConfig))
        {
            throw Invalid("secretUpdate");
        }
        if (operation == null && JsonElement.DeepEquals(settings.ProviderConfig, request.ProviderConfig) &&
            JsonElement.DeepEquals(settings.Authentication, request.Authentication))
        {
            return (null, false);
        }

        // An explicit keep re-encrypts under the active key. Changed public settings also require rebinding.
        return (protector.Unprotect(scope, previous), false);
    }

    private readonly record struct CredentialRule(
        string? Operation, bool SameMethod, Func<JsonElement, JsonElement>? ReadReplacement);

    private static CredentialRule ReadPrometheus(ReleaseMetricSourceConnectionBase request, JsonElement? previousAuth)
    {
        var operation = ReadOperation(request.SecretUpdate, replacementFields: 1);
        var (type, sameMethod) = ReadMethod("type", request.Authentication, previousAuth);
        var hasUsername = request.Authentication.TryGetProperty("username", out var username);

        Func<JsonElement, JsonElement>? readReplacement = type switch
        {
            "basic" when hasUsername && IsNonEmptyString(username) => update => ReadRequiredSecret(update, "password"),
            "bearer_token" when !hasUsername => update => ReadRequiredSecret(update, "token"),
            "none" or "" when !hasUsername => null,
            _ => throw Invalid("authentication")
        };
        return new(operation, sameMethod, readReplacement);
    }

    private static CredentialRule ReadAzureMonitor(ReleaseMetricSourceConnectionBase request, JsonElement? previousAuth)
    {
        var operation = ReadOperation(request.SecretUpdate, replacementFields: 1);
        var (mode, sameMethod) = ReadMethod("mode", request.Authentication, previousAuth);

        Func<JsonElement, JsonElement>? readReplacement = mode switch
        {
            "ClientSecret" => update => ReadRequiredSecret(update, "clientSecret"),
            "" => null,
            _ => throw Invalid("authentication")
        };
        return new(operation, sameMethod, readReplacement);
    }

    private static JsonElement ReadRequiredSecret(JsonElement update, string secretField)
    {
        if (!update.TryGetProperty(secretField, out var value) || !IsNonEmptyString(value))
        {
            throw Invalid("secretUpdate");
        }

        return JsonSerializer.SerializeToElement(new Dictionary<string, JsonElement> { [secretField] = value });
    }

    private static string? ReadOperation(JsonElement update, int replacementFields)
    {
        if (update.ValueKind == JsonValueKind.Undefined)
        {
            return null;
        }
        if (update.ValueKind != JsonValueKind.Object || !update.TryGetProperty("operation", out var operation) ||
            operation.ValueKind != JsonValueKind.String)
        {
            throw Invalid("secretUpdate");
        }

        var name = operation.GetString();
        var expectedFields = name == "replace" ? 1 + replacementFields : 1;
        if (update.EnumerateObject().Count() != expectedFields)
        {
            throw Invalid("secretUpdate");
        }
        return name;
    }

    private static (string? Method, bool SameMethod) ReadMethod(string field, JsonElement authentication, JsonElement? previous)
    {
        var method = Value(authentication);
        return (method, previous.HasValue && Value(previous.Value) == method);

        string? Value(JsonElement auth)
        {
            if (!auth.TryGetProperty(field, out var value) || value.ValueKind == JsonValueKind.Null)
            {
                return "";
            }
            return IsNonEmptyString(value) ? value.GetString() : null;
        }
    }

    private static bool HasOnlyStringsOrNulls(JsonElement settings) => settings.EnumerateObject()
        .All(field => field.Value.ValueKind is JsonValueKind.String or JsonValueKind.Null);

    private static bool IsNonEmptyString(JsonElement value) =>
        value.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(value.GetString());

    private static ValidationException Invalid(string field) => new([
        new ValidationFailure(field, "Invalid connection settings") { ErrorCode = ErrorCodes.Invalid(field) }
    ]);
}
