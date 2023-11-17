using Api.Authentication.OpenIdConnect;
using Application.Identity;
using Application.Services;
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
        var (error, workspace) = await ValidateOidcAsync(workspaceKey);
        if (!string.IsNullOrWhiteSpace(error))
        {
            return BadRequest(error);
        }

        var oidcConfig = workspace!.Sso!.Oidc;
        var url = _client.GetAuthorizeUrl(redirectUri, workspaceKey, oidcConfig);
        return Redirect(url);
    }

    [HttpPost("oidc/login")]
    public async Task<ApiResponse<LoginToken>> OidcLoginByCode(LoginByOidcCode request)
    {
        var (error, workspace) = await ValidateOidcAsync(request.WorkspaceKey);
        if (!string.IsNullOrWhiteSpace(error))
        {
            return Error<LoginToken>(error);
        }

        try
        {
            var oidcConfig = workspace!.Sso!.Oidc;

            var email = await _client.GetEmailAsync(request, oidcConfig);
            if (string.IsNullOrWhiteSpace(email))
            {
                return Error<LoginToken>(
                    $"Can not get email from id_token by using claim ${oidcConfig.UserEmailClaim}. Please check your 'UserEmailClaim' configuration"
                );
            }

            LoginToken token;
            var user = await _userService.FindOneAsync(x => x.Email == email && x.WorkspaceId == workspace.Id);
            if (user == null)
            {
                var registerResult = await _identityService.RegisterByEmailAsync(workspace.Id, email, string.Empty, UserOrigin.Sso);
                token = new LoginToken(true, registerResult.Token);
            }
            else
            {
                token = new LoginToken(false, _identityService.IssueToken(user));
            }

            return Ok(token);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception occurred when login by oidc code");

            return Error<LoginToken>(ex.Message);
        }
    }

    [HttpGet("check-enabled")]
    public ApiResponse<bool> Enabled() => Ok(_isEnabled);

    private async Task<(string error, Workspace? workspace)> ValidateOidcAsync(string workspaceKey)
    {
        if (!_isEnabled)
        {
            return ("SSO is not enabled", null);
        }

        var workspace = await _workspaceService.FindOneAsync(x => x.Key == workspaceKey);
        if (workspace == null)
        {
            return ("Workspace not found", null);
        }

        var isSsoGranted = workspace.IsFeatureGranted(LicenseFeatures.Sso);
        if (!isSsoGranted)
        {
            return (
                "You don't have a license or your current license doesn't grant the SSO feature, please contact FeatBit team to get a license.",
                workspace
            );
        }

        var oidcConfig = workspace.Sso?.Oidc;
        if (oidcConfig is null)
        {
            return ("SSO (OIDC) is not configured", workspace);
        }

        return (string.Empty, workspace);
    }
}