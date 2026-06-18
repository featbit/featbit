using Domain.Shared;
using Domain.Shared.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Internal;
using Microsoft.Extensions.Logging;
using Streaming.Services;

namespace Streaming.Connections;

/// <summary>
/// Validates streaming requests pre-accept (before accepting the WebSocket).
/// v1: performs structural validation (type, version, token parse) and store lookup with fallback handling.
/// v2/HMAC validation added in a future PR.
/// </summary>
public sealed class RequestValidator(
    ISystemClock systemClock,
    IStore store,
    StreamingOptions options,
    IRelayProxyService rpService,
    ITokenValidator tokenValidator,
    ILogger<RequestValidator> logger)
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
            var query = httpContext.Request.QueryString.Value ?? string.Empty;
            logger.ErrorValidateRequest(query, ex);

            // Unhandled exception → store unavailable → return Unavailable for transient retry
            return ValidationResult.Unavailable($"Validation error: {ex.Message}");
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
            return ValidationResult.Failed($"Invalid type: {type}");
        }

        // connection version
        if (!options.SupportedVersions.Contains(version))
        {
            return ValidationResult.Failed($"Invalid version: {version}");
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
                    ? ValidationResult.Failed($"Invalid relay proxy token: {tokenString}")
                    : ValidationResult.Ok(serverSecrets);
            }
            catch (Exception ex)
            {
                logger.LogError("RelayProxy secret lookup failed: {Error}", ex.Message);
                // Store unavailable → return Unavailable for transient retry
                return ValidationResult.Unavailable($"RelayProxy validation unavailable: {ex.Message}");
            }
        }

        async Task<ValidationResult> ValidateSecretTokenAsync()
        {
            // Validate token envelope first (timestamp + encoded secret payload)
            var token = new Token(tokenString.AsSpan());
            var current = systemClock.UtcNow.ToUnixTimeMilliseconds();

            if (!token.IsValid)
            {
                return ValidationResult.Failed($"Invalid token: {tokenString}");
            }

            // v1: structural-only validation of the parsed secret string
            var structuralValidation = await tokenValidator.ValidateAsync(token.SecretString);
            if (structuralValidation.Status == TokenValidationStatus.Invalid)
            {
                return ValidationResult.Failed($"Invalid token: {structuralValidation.Reason}");
            }

            if (Math.Abs(current - token.Timestamp) > options.TokenExpirySeconds * 1000)
            {
                return ValidationResult.Failed($"Token is expired: {tokenString}");
            }

            // Store lookup with fallback handling (wrap in try/catch)
            try
            {
                var secret = await store.GetSecretAsync(token.SecretString);
                if (secret is null)
                {
                    return ValidationResult.Failed($"Secret is not found: {token.SecretString}");
                }

                if (secret.Type != type)
                {
                    return ValidationResult.Failed($"Inconsistent secret used: {secret.Type}. Request type: {type}");
                }

                return ValidationResult.Ok([secret]);
            }
            catch (Exception ex)
            {
                logger.LogError("Secret store lookup failed: {Error}", ex.Message);
                // Store unavailable → return Unavailable for transient retry
                return ValidationResult.Unavailable($"Secret lookup unavailable: {ex.Message}");
            }
        }
    }
}