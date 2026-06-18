using System.Security.Claims;
using System.Text.Encodings.Web;
using Domain.Shared.Authentication;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Api.Authentication;

/// <summary>
/// Authentication handler for FeatBit v1 tokens.
/// v1: performs structural validation only (Secret.TryParse).
/// v2/HMAC validation with store lookup is added in a future PR.
/// </summary>
public class FeatBitAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    private readonly ITokenValidator _tokenValidator;

    public FeatBitAuthHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        ITokenValidator tokenValidator)
        : base(options, logger, encoder)
    {
        _tokenValidator = tokenValidator;
    }

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        string? credential = Request.Headers.Authorization.ToString();
        if (string.IsNullOrEmpty(credential))
        {
            return AuthenticateResult.NoResult();
        }

        var result = await _tokenValidator.ValidateAsync(credential);
        if (result.Status == TokenValidationStatus.Valid)
        {
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

        return AuthenticateResult.Fail(result.Reason);
    }
}
