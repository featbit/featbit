using Api.Authentication.OpenIdConnect;
using Application.Services;
using Domain.Organizations;
using Domain.Policies;

namespace Api.Controllers;

[AllowAnonymous]
[Route("api/v{version:apiVersion}/sso")]
public class SsoController : ApiControllerBase
{
    private readonly OidcClient _client;
    private readonly IUserService _userService;
    private readonly IIdentityService _identityService;
    private readonly IOrganizationService _organizationService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<SsoController> _logger;

    public SsoController(
        OidcClient client,
        IUserService userService,
        IIdentityService identityService,
        IOrganizationService organizationService,
        IConfiguration configuration,
        ILogger<SsoController> logger)
    {
        _client = client;
        _userService = userService;
        _identityService = identityService;
        _organizationService = organizationService;
        _configuration = configuration;
        _logger = logger;
    }

    [HttpGet("oidc-authorize-url")]
    public IActionResult GetOidcAuthorizeUrl()
    {
        if (!Enabled())
        {
            return BadRequest("SSO not enabled");
        }

        var url = _client.GetAuthorizeUrl();
        return Redirect(url);
    }

    [HttpGet("oidc/login")]
    public async Task<IActionResult> OidcLoginByCode(string code)
    {
        if (!Enabled())
        {
            return BadRequest("SSO not enabled");
        }

        var success = false;
        var token = string.Empty;

        try
        {
            var email = await _client.GetEmailAsync(code);
            if (string.IsNullOrWhiteSpace(email))
            {
                return BadRequest("Can not get email from id_token");
            }

            var user = await _userService.FindByEmailAsync(email);
            if (user == null)
            {
                // register user by email
                var registerResult = await _identityService.RegisterByEmailAsync(email, string.Empty);

                // add user to organization
                var organization = await _organizationService.GetDefaultSsoOrganizationAsync();
                var organizationUser = new OrganizationUser(organization.Id, registerResult.UserId);
                await _organizationService.AddUserAsync(organizationUser, policies: new[] { BuiltInPolicy.Developer });

                token = registerResult.Token;
                success = true;
            }
            else
            {
                token = _identityService.IssueToken(user);
                success = true;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception occurred when login by oidc code");
        }

        return new JsonResult(new { success, token });
    }

    [HttpGet("check-enabled")]
    public bool Enabled() =>
        "true".Equals(_configuration["SSO:enabled"], StringComparison.CurrentCultureIgnoreCase);
}