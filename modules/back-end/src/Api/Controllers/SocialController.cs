using System.Text.Json;
using Api.Authentication.OAuth;
using Api.Authentication.OpenIdConnect;
using Application.CloudConfig;
using Application.Identity;
using Application.Services;
using AutoMapper;
using Domain.CloudConfig;
using Domain.Users;
using Domain.Workspaces;

namespace Api.Controllers;

[AllowAnonymous]
[Route("api/v{version:apiVersion}/social")]
public class SosialController : ApiControllerBase
{
    private readonly SocialClient _client;
    private readonly IUserService _userService;
    private readonly IIdentityService _identityService;
    private readonly IWorkspaceService _workspaceService;
    private readonly ILogger<SsoController> _logger;
    private readonly ICollection<SocialProvider> _socialProviders;
    private readonly IMapper _mapper;

    public SosialController(
        SocialClient client,
        IUserService userService,
        IIdentityService identityService,
        IWorkspaceService workspaceService,
        IConfiguration configuration,
        ILogger<SsoController> logger,
        IMapper mapper)
    {
        _socialProviders = configuration.GetSection("SocialProviders").Get<SocialProvider[]>();
        _client = client;
        _userService = userService;
        _identityService = identityService;
        _workspaceService = workspaceService;
        _logger = logger;
        _mapper = mapper;
    }

    [HttpPost("login")]
    public async Task<ApiResponse<LoginToken>> OidcLoginByCode(LoginBySocial request)
    {
        var (error, provider) = ValidateSocialLoginParam(request.ProviderName);
        if (!string.IsNullOrWhiteSpace(error))
        {
            return Error<LoginToken>(error);
        }

        try
        {
            // Get access token from code
            var email = await _client.GetEmailAsync(request, provider);
            
            if (string.IsNullOrWhiteSpace(email))
            {
                return Error<LoginToken>(
                    $"Can not get email from id_token"
                );
            }
            
            LoginToken token;
            var user = await _userService.FindOneAsync(x => x.Email == email);
            if (user == null)
            {
                var workspace = new Workspace
                {
                    Name = "Default Workspace",
                    Key = "default-workspace"
                };
                await _workspaceService.AddOneAsync(workspace);
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

    [HttpGet("providers")]
    public ApiResponse<IEnumerable<SocialProviderVm>> Providers()
    {
        var providers = _socialProviders?.Any() != true
            ? Array.Empty<SocialProviderVm>()
            : _mapper.Map<IEnumerable<SocialProviderVm>>(_socialProviders);
        
        return Ok(providers);
    }

    private (string error, SocialProvider?) ValidateSocialLoginParam(string providerName)
    {
        var provider = _socialProviders?.FirstOrDefault(x => x.Name == providerName);
        
        if (provider == null)
        {
            return ("Social login is not enabled", null);
        }
        
        return (string.Empty, provider);
    }
}