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
            logger.ErrorValidateRequest(ex);

            // Unexpected exception that escaped inner catches — treat as permanent rejection
            // (store/relay unavailability is already caught and returned as Unavailable by inner handlers)
            return ValidationResult.Invalid($"Request validation failed: {ex.Message}");
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
                logger.ErrorLookupRelayProxyToken(ex);

                // Store unavailable → return Unavailable for transient retry
                return ValidationResult.Unavailable($"Relay proxy lookup unavailable. ex={ex.GetType().Name}");
            }
        }

        async Task<ValidationResult> ValidateSecretTokenAsync()
        {
            var token = new Token(tokenString.AsSpan());
            if (!token.IsValid)
            {
                return ValidationResult.Invalid("Invalid token format");
            }

            TokenValidationResult validationResult;
            try
            {
                // v1: structural-only validation of the parsed secret string
                validationResult = await tokenValidator.ValidateAsync(token.SecretString);
            }
            catch (Exception ex)
            {
                logger.FailedToParseToken(ex);

                return ValidationResult.Invalid($"Secret validation failed. ex={ex.GetType().Name}");
            }

            if (validationResult.Status == TokenValidationStatus.Invalid)
            {
                return ValidationResult.Invalid("Invalid secret format");
            }

            var currentTime = systemClock.UtcNow;
            var currentTimestamp = currentTime.ToUnixTimeMilliseconds();
            var serverMinusTokenMs = currentTimestamp - token.Timestamp;
            if (Math.Abs(serverMinusTokenMs) > options.TokenExpirySeconds * 1000)
            {
                var tokenTime = DateTimeOffset.FromUnixTimeMilliseconds(token.Timestamp).ToString("O");
                return ValidationResult.Invalid(
                    $"Token timestamp out of range. TokenTime={tokenTime}({token.Timestamp}); ServerTime={currentTime:O}({currentTimestamp}); ServerMinusTokenMs={serverMinusTokenMs}; Configured Streaming:TokenExpirySeconds={options.TokenExpirySeconds}s; env={validationResult.EnvId}; ct={type}; v={version}"
                );
            }

            // Store lookup with fallback handling (wrap in try/catch)
            try
            {
                var secret = await store.GetSecretAsync(token.SecretString);
                if (secret is null)
                {
                    return ValidationResult.Invalid($"Secret not found. env={validationResult.EnvId}; ct={type}; v={version}");
                }

                if (secret.Type != type)
                {
                    return ValidationResult.Invalid($"Secret type mismatch. st={secret.Type}; ct={type}; v={version}; env={validationResult.EnvId}");
                }

                return ValidationResult.Valid([secret]);
            }
            catch (Exception ex)
            {
                logger.ErrorLookupSecretToken(ex);

                // Store unavailable → return Unavailable for transient retry
                return ValidationResult.Unavailable($"Secret lookup unavailable. env={validationResult.EnvId}; ct={type}; v={version}; ex={ex.GetType().Name}");
            }
        }
    }
}