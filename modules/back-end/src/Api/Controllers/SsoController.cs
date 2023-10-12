using Api.Authentication.OpenIdConnect;
using Application.Identity;
using Application.Services;
using Domain.Organizations;
using Domain.Policies;
using Domain.Users;

namespace Api.Controllers;

[AllowAnonymous]
[Route("api/v{version:apiVersion}/sso")]
public class SsoController : ApiControllerBase
{
    private readonly bool _isEnabled;

    private readonly OidcClient _client;
    private readonly IUserService _userService;
    private readonly ILicenseService _licenseService;
    private readonly IIdentityService _identityService;
    private readonly IOrganizationService _organizationService;
    private readonly ILogger<SsoController> _logger;

    public SsoController(
        OidcClient client,
        IUserService userService,
        ILicenseService licenseService,
        IIdentityService identityService,
        IOrganizationService organizationService,
        IConfiguration configuration,
        ILogger<SsoController> logger)
    {
        _isEnabled = "true".Equals(configuration["SSO:enabled"], StringComparison.CurrentCultureIgnoreCase);

        _client = client;
        _userService = userService;
        _licenseService = licenseService;
        _identityService = identityService;
        _organizationService = organizationService;
        _logger = logger;
    }

    [HttpGet("oidc-authorize-url")]
    public IActionResult GetOidcAuthorizeUrl([FromQuery(Name = "redirect_uri")] string? redirectUri = null)
    {
        if (!_isEnabled)
        {
            return BadRequest("SSO not enabled");
        }

        var url = _client.GetAuthorizeUrl(redirectUri);
        return Redirect(url);
    }

    [HttpPost("oidc/login")]
    public async Task<ApiResponse<LoginToken>> OidcLoginByCode(LoginByOidcCode request)
    {
        if (!_isEnabled)
        {
            return Error<LoginToken>("SSO not enabled");
        }

        try
        {
            var organization = await _organizationService.GetDefaultSsoOrganizationAsync();

            var isSsoGranted = await _licenseService.IsFeatureGrantedAsync(organization.Id, LicenseFeatures.Sso);
            if (!isSsoGranted)
            {
                return Error<LoginToken>(
                    "You don't have a license or your current license doesn't grant the SSO feature, please contact FeatBit team to get a license."
                );
            }

            string token;

            var email = await _client.GetEmailAsync(request);
            if (string.IsNullOrWhiteSpace(email))
            {
                return Error<LoginToken>("Can not get email from id_token");
            }

            var user = await _userService.FindByEmailAsync(email);
            if (user == null)
            {
                // register user by email
                var registerResult = await _identityService.RegisterByEmailAsync(email, string.Empty, UserOrigin.Sso);

                // add user to organization
                var organizationUser = new OrganizationUser(organization.Id, registerResult.UserId);
                await _organizationService.AddUserAsync(organizationUser, policies: new[] { BuiltInPolicy.Developer });

                token = registerResult.Token;
            }
            else
            {
                token = _identityService.IssueToken(user);
            }

            return Ok(new LoginToken(token));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception occurred when login by oidc code");

            return Error<LoginToken>(ex.Message);
        }
    }

    [HttpGet("check-enabled")]
    public ApiResponse<bool> Enabled() => Ok(_isEnabled);
}