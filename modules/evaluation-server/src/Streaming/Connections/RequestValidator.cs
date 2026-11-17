using Domain.Secrets;
using Domain.Shared;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Internal;
using Streaming.Services;

namespace Streaming.Connections;

public sealed class RequestValidator(
    ISystemClock systemClock,
    StreamingOptions options,
    IRelayProxyService rpService,
    SecretCache secretCache)
    : IRequestValidator
{
    public async Task<ValidationResult> ValidateAsync(HttpContext httpContext)
    {
        try
        {
            return await ValidateCoreAsync(httpContext);
        }
        catch (Exception ex)
        {
            return ValidationResult.Unavailable("Request validation unavailable.", ex);
        }
    }

    private async Task<ValidationResult> ValidateCoreAsync(HttpContext httpContext)
    {
        var query = httpContext.Request.Query;
        var type = query["type"].ToString();
        var version = query["version"].ToString();
        var tokenString = query["token"].ToString();

        // connection type
        if (!options.SupportedTypes.Contains(type))
        {
            return ValidationResult.Invalid($"Invalid connection type. ct={type}");
        }

        // connection version
        if (!options.SupportedVersions.Contains(version))
        {
            return ValidationResult.Invalid($"Invalid protocol version. ct={type}; v={version}");
        }

        if (string.IsNullOrWhiteSpace(tokenString))
        {
            return ValidationResult.Invalid($"Missing token. ct={type}; v={version}");
        }

        return type == ConnectionType.RelayProxy
            ? await ValidateRelayProxyAsync()
            : await ValidateSecretTokenAsync();

        async Task<ValidationResult> ValidateRelayProxyAsync()
        {
            try
            {
                var serverSecrets = await rpService.GetServerSecretsAsync(tokenString);
                return serverSecrets.Length == 0
                    ? ValidationResult.Invalid("Relay proxy lookup found no server secrets")
                    : ValidationResult.Valid(serverSecrets);
            }
            catch (Exception ex)
            {
                // Store unavailable → return Unavailable for transient retry
                return ValidationResult.Unavailable("Relay proxy lookup unavailable.", ex);
            }
        }

        async Task<ValidationResult> ValidateSecretTokenAsync()
        {
            // check token format
            var token = new Token(tokenString.AsSpan());
            if (!token.IsValid)
            {
                return ValidationResult.Invalid("Invalid token format");
            }

            // check secret format
            if (!Secret.TryParse(token.SecretString, out var envId))
            {
                return ValidationResult.Invalid("Invalid secret format");
            }

            // check token clock skew (server time vs token timestamp)
            var currentTime = systemClock.UtcNow;
            var currentTimestamp = currentTime.ToUnixTimeMilliseconds();
            var serverMinusTokenMs = currentTimestamp - token.Timestamp;
            if (Math.Abs(serverMinusTokenMs) > options.TokenExpirySeconds * 1000)
            {
                var tokenTime = DateTimeOffset.FromUnixTimeMilliseconds(token.Timestamp).ToString("O");
                return ValidationResult.Invalid(
                    $"Token timestamp out of range. TokenTime={tokenTime}({token.Timestamp}); ServerTime={currentTime:O}({currentTimestamp}); ServerMinusTokenMs={serverMinusTokenMs}; Configured Streaming:TokenExpirySeconds={options.TokenExpirySeconds}s; env={envId}; ct={type}; v={version}"
                );
            }

            // check secret
            Secret? secret;
            try
            {
                secret = await secretCache.GetAsync(token.SecretString);
            }
            catch (Exception ex)
            {
                return ValidationResult.Unavailable(
                    $"Secret lookup unavailable. env={envId}; ct={type}; v={version}", ex
                );
            }

            if (secret is null || secret.EnvId != envId)
            {
                return ValidationResult.Invalid("Invalid environment secret");
            }

            if (secret.Type != type)
            {
                return ValidationResult.Invalid(
                    $"Secret type mismatch. st={secret.Type}; ct={type}; v={version}; env={secret.EnvId}"
                );
            }

            return ValidationResult.Valid([secret]);
        }
    }
}
