using Api.Authentication.OpenIdConnect;
using Application.Identity;
using Application.Services;
using Domain.Observability;
using Domain.Users;
using Domain.Workspaces;

namespace Api.Controllers;

[AllowAnonymous]
[Route("api/v{version:apiVersion}/sso")]
public class SsoController : ApiControllerBase
{
    private readonly bool _isEnabled;

    private readonly OidcClient _client;
    private readonly IUserService _userService;
    private readonly IIdentityService _identityService;
    private readonly IWorkspaceService _workspaceService;
    private readonly ILogger<SsoController> _logger;

    public SsoController(
        OidcClient client,
        IUserService userService,
        IIdentityService identityService,
        IWorkspaceService workspaceService,
        IConfiguration configuration,
        ILogger<SsoController> logger)
    {
        _isEnabled = "true".Equals(configuration["SSOEnabled"], StringComparison.CurrentCultureIgnoreCase);

        _client = client;
        _userService = userService;
        _identityService = identityService;
        _workspaceService = workspaceService;
        _logger = logger;
    }

    [HttpGet("oidc-authorize-url")]
    public async Task<IActionResult> GetOidcAuthorizeUrl(
        [FromQuery(Name = "redirect_uri")] string redirectUri,
        [FromQuery(Name = "workspace_key")] string workspaceKey)
    {
        var (error, reason, workspace) = await ValidateOidcAsync(workspaceKey);
        if (!string.IsNullOrWhiteSpace(error))
        {
            // Counted as a rejected login: the user has clicked "sign in with SSO" and will never
            // reach the login endpoint, so this is where a misconfigured deployment surfaces.
            AuthMetrics.Current.RecordLogin(AuthMethods.Oidc, Outcomes.Rejected, reason);
            return BadRequest(error);
        }

        var oidcConfig = workspace!.Sso!.Oidc;
        var url = _client.GetAuthorizeUrl(redirectUri, workspaceKey, oidcConfig);
        return Redirect(url);
    }

    [HttpPost("oidc/login")]
    public async Task<ApiResponse<LoginToken>> OidcLoginByCode(LoginByOidcCode request)
    {
        var metrics = AuthMetrics.Current;

        var (error, reason, workspace) = await ValidateOidcAsync(request.WorkspaceKey);
        if (!string.IsNullOrWhiteSpace(error))
        {
            metrics.RecordLogin(AuthMethods.Oidc, Outcomes.Rejected, reason);
            return Error<LoginToken>(error);
        }

        try
        {
            var oidcConfig = workspace!.Sso!.Oidc;

            var email = await _client.GetEmailAsync(request, oidcConfig);
            if (string.IsNullOrWhiteSpace(email))
            {
                metrics.RecordLogin(AuthMethods.Oidc, Outcomes.Rejected, AuthReasons.NoEmail);

                return Error<LoginToken>(
                    $"Can not get email from id_token by using claim ${oidcConfig.UserEmailClaim}. Please check your 'UserEmailClaim' configuration"
                );
            }

            bool isSsoFirstLogin;
            var user = await _userService.FindOneAsync(x => x.Email == email);
            if (user == null)
            {
                var registerResult =
                    await _identityService.RegisterByEmailAsync(email, string.Empty, UserOrigin.Sso);

                isSsoFirstLogin = true;
                user = registerResult.User;
            }
            else
            {
                isSsoFirstLogin = false;
            }

            // ensure the user is in the workspace
            await _workspaceService.AddUserIfNotExistsAsync(workspace.Id, user.Id);

            var (accessToken, refreshToken) =
                await _identityService.IssueTokensAsync(user, Request.ClientIpAddress());
            Response.SetRefreshTokenCookie(refreshToken);

            metrics.RecordLogin(AuthMethods.Oidc, Outcomes.Success, AuthReasons.Granted);

            return Ok(new LoginToken(isSsoFirstLogin, accessToken));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception occurred when login by oidc code");

            metrics.RecordLogin(AuthMethods.Oidc, Outcomes.Failure, AuthReasons.Error);

            return Error<LoginToken>(ex.Message);
        }
    }

    [HttpGet("pre-check")]
    public async Task<ApiResponse<SsoPreCheck>> PreCheck()
    {
        var workspaceKey = await _workspaceService.GetDefaultWorkspaceAsync();
        var preCheck = new SsoPreCheck(_isEnabled, workspaceKey);

        return Ok(preCheck);
    }

    /// <summary>
    /// Validates that OIDC is usable for <paramref name="workspaceKey"/>.
    /// </summary>
    /// <returns>
    /// The user-facing error message (empty when valid), a bounded <see cref="AuthReasons"/> value
    /// for metrics, and the workspace. The reason is returned alongside the message rather than
    /// derived from it, because the message is prose and must never become a metric tag.
    /// </returns>
    private async Task<(string error, string reason, Workspace? workspace)> ValidateOidcAsync(string workspaceKey)
    {
        if (!_isEnabled)
        {
            return ("SSO is not enabled", AuthReasons.NotEnabled, null);
        }

        var workspace = await _workspaceService.FindOneAsync(x => x.Key == workspaceKey);
        if (workspace == null)
        {
            return ("Workspace not found", AuthReasons.WorkspaceNotFound, null);
        }

        var isSsoGranted = workspace.IsFeatureGranted(LicenseFeatures.Sso);
        if (!isSsoGranted)
        {
            return (
                "You don't have a license or your current license doesn't grant the SSO feature, please contact FeatBit team to get a license.",
                AuthReasons.NotLicensed,
                workspace
            );
        }

        var oidcConfig = workspace.Sso?.Oidc;
        if (oidcConfig is null)
        {
            return ("SSO (OIDC) is not configured", AuthReasons.NotConfigured, workspace);
        }

        return (string.Empty, AuthReasons.Granted, workspace);
    }
}