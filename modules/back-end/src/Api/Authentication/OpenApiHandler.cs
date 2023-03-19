using System.Security.Claims;
using System.Text.Encodings.Web;
using Application.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace Api.Authentication;

public class OpenApiHandler : AuthenticationHandler<OpenApiOptions>
{
    private readonly IAccessTokenService _accessTokenService;

    public OpenApiHandler(
        IOptionsMonitor<OpenApiOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        ISystemClock clock,
        IAccessTokenService accessTokenService) : base(options, logger, encoder, clock)
    {
        _accessTokenService = accessTokenService;
    }

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        try
        {
            string token = Request.Headers.Authorization;

            // If no authorization header found, nothing to process further
            if (string.IsNullOrEmpty(token))
            {
                return AuthenticateResult.NoResult();
            }

            var accessToken = await _accessTokenService.FindOneAsync(x => x.Token == token);
            if (accessToken == null)
            {
                return AuthenticateResult.Fail("invalid-access-token");
            }

            var identity = new ClaimsIdentity(Array.Empty<Claim>());
            var claimsPrincipal = new ClaimsPrincipal(identity);
            var ticket = new AuthenticationTicket(claimsPrincipal, Scheme.Name);

            Context.Items[OpenApiConstants.AccessTokenStoreKey] = accessToken;

            return AuthenticateResult.Success(ticket);
        }
        catch (Exception ex)
        {
            return AuthenticateResult.Fail(ex);
        }
    }
}