using System.Security.Claims;
using System.Text.Encodings.Web;
using Application;
using Application.Services;
using Domain.AccessTokens;
using Domain.Users;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace Api.Authentication;

public class OpenApiHandler(
    IOptionsMonitor<OpenApiOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    IOrganizationService organizationService,
    IAccessTokenService accessTokenService)
    : AuthenticationHandler<OpenApiOptions>(options, logger, encoder)
{
    private static readonly TimeSpan LastUsedAtRefreshInterval = TimeSpan.FromMinutes(1);

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        try
        {
            string? token = Request.Headers.Authorization;

            // If no authorization header found, nothing to process further
            if (string.IsNullOrEmpty(token))
            {
                return AuthenticateResult.NoResult();
            }

            var accessToken =
                await accessTokenService.FindOneAsync(x => x.Token == token && x.Status == AccessTokenStatus.Active);
            if (accessToken == null)
            {
                return AuthenticateResult.Fail("invalid-access-token");
            }

            // set workspace, organization id header & store permissions
            var org = await organizationService.GetAsync(accessToken.OrganizationId);
            Context.Request.Headers.TryAdd(ApiConstants.WorkspaceHeaderKey, org.WorkspaceId.ToString());
            Context.Request.Headers.TryAdd(ApiConstants.OrgIdHeaderKey, org.Id.ToString());

            // store access token in context for later use
            Context.Items[ApplicationConsts.AccessTokenItem] = accessToken;

            // refresh LastUsedAt at most once per minute to avoid write amplification on chatty callers
            if (accessToken.LastUsedAt is null ||
                DateTime.UtcNow - accessToken.LastUsedAt.Value >= LastUsedAtRefreshInterval)
            {
                try
                {
                    await accessTokenService.RefreshLastUsedAtAsync(accessToken.Id);
                }
                catch (Exception ex)
                {
                    // a transient DB error here shouldn't reject valid access token
                    Logger.LogWarning(ex, "Failed to refresh LastUsedAt for access token {AccessTokenId}", accessToken.Id);
                }
            }

            // construct ticket
            var identity = new ClaimsIdentity(Schemes.OpenApi);
            identity.AddClaim(new Claim(UserClaims.Id, accessToken.Id.ToString()));

            var claimsPrincipal = new ClaimsPrincipal(identity);
            var ticket = new AuthenticationTicket(claimsPrincipal, Scheme.Name);

            return AuthenticateResult.Success(ticket);
        }
        catch (Exception ex)
        {
            return AuthenticateResult.Fail(ex);
        }
    }
}