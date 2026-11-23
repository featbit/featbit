#nullable enable

using System.Text.Json;
using Application.Bases;
using FluentValidation.Results;

namespace Application.ReleaseMetricSourceConnections;

internal static class PrometheusConnectionEndpoint
{
    internal static bool HasSameOrigin(JsonElement original, JsonElement draft)
    {
        // Unchanged legacy settings may be incomplete. Keeping them does not change the credential target.
        if (JsonElement.DeepEquals(original, draft))
        {
            return true;
        }
        var before = Read(original);
        var after = Read(draft);
        return before.Scheme == after.Scheme && before.Port == after.Port &&
               string.Equals(before.IdnHost, after.IdnHost, StringComparison.OrdinalIgnoreCase);
    }

    private static Uri Read(JsonElement config)
    {
        if (!ReleaseMetricSourceConnectionBaseValidator.IsPrometheusConfig(config) ||
            !config.TryGetProperty("endpoint", out var value) || value.ValueKind != JsonValueKind.String ||
            !Uri.TryCreate(value.GetString(), UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp) ||
            uri.Host.Length == 0 || uri.UserInfo.Length != 0 || !uri.IsWellFormedOriginalString())
        {
            throw InvalidEndpoint();
        }
        return uri;
    }

    private static ValidationException InvalidEndpoint() => new([
        new ValidationFailure("providerConfig", "Invalid Prometheus endpoint") { ErrorCode = ErrorCodes.Invalid("providerConfig") }
    ]);
}
