using System.Net.WebSockets;
using Domain.Shared;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Internal;
using Microsoft.Extensions.Logging;
using Streaming.Services;

namespace Streaming.Connections;

public sealed class RequestValidator(
    ISystemClock systemClock,
    IStore store,
    StreamingOptions options,
    IServiceProvider serviceProvider,
    ILogger<RequestValidator> logger)
    : IRequestValidator
{
    private const long TokenTimeoutMs = 30 * 1000;

    public async Task<ValidationResult> ValidateAsync(ConnectionContext context)
    {
        try
        {
            return await ValidateCoreAsync(context);
        }
        catch (Exception ex)
        {
            logger.ErrorValidateRequest(context.RawQuery, ex);

            // throw original exception
            throw;
        }
    }

    private async Task<ValidationResult> ValidateCoreAsync(ConnectionContext context)
    {
        var (ws, type, version, tokenString) = context;

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

        // websocket state
        if (ws is not { State: WebSocketState.Open })
        {
            return ValidationResult.Failed($"Invalid websocket state: {ws?.State}");
        }

        return type == ConnectionType.RelayProxy
            ? await ValidateRelayProxyAsync()
            : await ValidateSecretTokenAsync();

        async Task<ValidationResult> ValidateRelayProxyAsync()
        {
            var rpService = serviceProvider.GetRequiredService<IRelayProxyService>();

            var serverSecrets = await rpService.GetServerSecretsAsync(tokenString);
            return serverSecrets.Length == 0
                ? ValidationResult.Failed($"Invalid relay proxy token: {tokenString}")
                : ValidationResult.Ok(serverSecrets);
        }

        async Task<ValidationResult> ValidateSecretTokenAsync()
        {
            var token = new Token(tokenString.AsSpan());
            var current = systemClock.UtcNow.ToUnixTimeMilliseconds();
            if (!token.IsValid)
            {
                return ValidationResult.Failed($"Invalid token: {tokenString}");
            }

            if (Math.Abs(current - token.Timestamp) > TokenTimeoutMs)
            {
                return ValidationResult.Failed($"Token is expired: {tokenString}");
            }

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
    }
}