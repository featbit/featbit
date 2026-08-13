using System.Security.Claims;
using System.Text.Encodings.Web;
using Domain.Shared.Authentication;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace Api.Authentication;

/// <summary>
/// Authentication handler for FeatBit v1 tokens.
/// v1: performs structural validation only (Secret.TryParse).
/// v2/HMAC validation with store lookup is added in a future PR.
/// </summary>
public class FeatBitAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    ITokenValidator tokenValidator)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
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

        var claims = new[]
        {
            new Claim(FeatBitClaims.EnvId, result.EnvId.ToString()),
            // SecretType, ProjectKey, EnvKey populated in PR 2 when store lookup is introduced
        };
        var identity = new ClaimsIdentity(claims, Scheme.Name);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, Scheme.Name);

        return AuthenticateResult.Success(ticket);
    }
}