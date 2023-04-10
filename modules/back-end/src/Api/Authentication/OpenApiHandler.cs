using System.Security.Claims;
using System.Text.Encodings.Web;
using Application.Services;
using Domain.AccessTokens;
using Domain.Users;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace Api.Authentication;

public class OpenApiHandler : AuthenticationHandler<OpenApiOptions>
{
    private readonly IAccessTokenService _accessTokenService;
    private readonly IMemberService _memberService;

    public OpenApiHandler(
        IOptionsMonitor<OpenApiOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        ISystemClock clock,
        IAccessTokenService accessTokenService,
        IMemberService memberService) : base(options, logger, encoder, clock)
    {
        _accessTokenService = accessTokenService;
        _memberService = memberService;
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

            var accessToken =
                await _accessTokenService.FindOneAsync(x => x.Token == token && x.Status == AccessTokenStatus.Active);
            if (accessToken == null)
            {
                return AuthenticateResult.Fail("invalid-access-token");
            }

            // set organization id header & store permissions
            Context.Request.Headers.Add(OpenApiConstants.OrgIdHeaderKey, accessToken.OrganizationId.ToString());
            if (accessToken.Type == AccessTokenTypes.Service)
            {
                Context.Items[OpenApiConstants.PermissionStoreKey] = accessToken.Permissions;
            }
            else
            {
                var policies =
                    await _memberService.GetPoliciesAsync(accessToken.OrganizationId, accessToken.CreatorId);

                var statements = policies.SelectMany(x => x.Statements);
                Context.Items[OpenApiConstants.PermissionStoreKey] = statements;
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