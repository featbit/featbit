using Api.Authentication.OAuth;
using Application.Identity;
using Application.Services;
using Application.Workspaces;
using Domain.Users;

namespace Api.Controllers;

[AllowAnonymous]
[Route("api/v{version:apiVersion}/social")]
public class SocialController : ApiControllerBase
{
    private readonly OAuthClient _oauthClient;
    private readonly OAuthProviders _oauthProviders;
    private readonly IUserService _userService;
    private readonly IIdentityService _identityService;
    private readonly ILogger<SocialController> _logger;

    public SocialController(
        OAuthClient oauthClient,
        IConfiguration configuration,
        IUserService userService,
        IIdentityService identityService,
        ILogger<SocialController> logger)
    {
        _oauthClient = oauthClient;
        _oauthProviders = new OAuthProviders(configuration);
        _userService = userService;
        _identityService = identityService;
        _logger = logger;
    }

    [HttpPost("login")]
    public async Task<ApiResponse<LoginToken>> Login(LoginByOAuthCode request)
    {
        var provider = _oauthProviders.GetProvider(request.ProviderName);
        if (provider == null)
        {
            return Error<LoginToken>($"Social login for ‘{request.ProviderName}’ is not supported.");
        }

        try
        {
            var email = await _oauthClient.GetEmailAsync(request, provider);
            if (string.IsNullOrWhiteSpace(email))
            {
                return Error<LoginToken>("Can not get email by OAuth code.");
            }

            LoginToken token;
            var user = await _userService.FindOneAsync(x => x.Email == email);
            if (user == null)
            {
                var createWorkspace = new CreateWorkspace
                {
                    Email = email,
                    Password = string.Empty,
                    UserOrigin = UserOrigin.OAuth
                };

                var registerResult = await Mediator.Send(createWorkspace);
                token = new LoginToken(false, registerResult.Token);
            }
            else
            {
                token = new LoginToken(false, _identityService.IssueToken(user));
            }

            return Ok(token);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception occurred when performing OAuth login.");

            return Error<LoginToken>(ex.Message);
        }
    }

    [HttpGet("providers")]
    public ApiResponse<IEnumerable<OAuthProviderVm>> Providers(string redirectUri)
    {
        var vms = _oauthProviders.Select(x => new OAuthProviderVm
        {
            Name = x.Name,
            AuthorizeUrl = x.GetAuthorizeUrl(redirectUri)
        });

        return Ok(vms);
    }
}