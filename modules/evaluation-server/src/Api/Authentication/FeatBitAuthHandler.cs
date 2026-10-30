using System.Security.Claims;
using System.Text.Encodings.Web;
using Domain.Shared;
using Domain.Shared.Authentication;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace Api.Authentication;

/// <summary>
/// Authentication handler for FeatBit v1 tokens.
/// Validates the complete environment secret against the store before creating claims.
/// </summary>
public class FeatBitAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    ITokenValidator tokenValidator,
    IStore store)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    private bool _storeUnavailable;

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var token = Request.Headers.Authorization.ToString();
        if (string.IsNullOrWhiteSpace(token))
        {
            return AuthenticateResult.NoResult();
        }

        var result = await tokenValidator.ValidateAsync(token);
        if (result.Status != TokenValidationStatus.Valid)
        {
            return AuthenticateResult.Fail(result.Reason);
        }

        Secret? secret;
        try
        {
            secret = await store.GetSecretAsync(token);
        }
        catch (Exception)
        {
            // Do not log the exception: store errors may contain the secret/key.
            Logger.LogWarning("Environment secret lookup unavailable");
            _storeUnavailable = true;
            return AuthenticateResult.Fail("Authentication service unavailable");
        }

        if (secret is null || secret.EnvId != result.EnvId ||
            secret.Type is not (SecretTypes.Client or SecretTypes.Server))
        {
            return AuthenticateResult.Fail("Invalid environment secret");
        }

        var claims = new[]
        {
            new Claim(FeatBitClaims.EnvId, secret.EnvId.ToString()),
            new Claim(FeatBitClaims.SecretType, secret.Type)
        };
        var identity = new ClaimsIdentity(claims, Scheme.Name);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, Scheme.Name);

        return AuthenticateResult.Success(ticket);
    }

    protected override Task HandleChallengeAsync(AuthenticationProperties properties)
    {
        if (!_storeUnavailable)
        {
            return base.HandleChallengeAsync(properties);
        }

        Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
        return Task.CompletedTask;
    }
}
