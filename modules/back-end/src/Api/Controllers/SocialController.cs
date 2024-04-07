using Api.Authentication.OAuth;
using Application.Identity;
using Application.OAuthProviders;
using Application.Services;
using AutoMapper;
using Domain.OAuthProviders;
using Domain.Organizations;
using Domain.Policies;
using Domain.Users;
using Domain.Workspaces;

namespace Api.Controllers;

[AllowAnonymous]
[Route("api/v{version:apiVersion}/social")]
public class SocialController : ApiControllerBase
{
    private readonly SocialClient _client;
    private readonly IIdentityService _identityService;
    private readonly ILogger<SsoController> _logger;
    private readonly IMapper _mapper;
    private readonly IOrganizationService _organizationService;
    private readonly IEnumerable<OAuthProvider> _oauthProviders;
    private readonly IUserService _userService;
    private readonly IWorkspaceService _workspaceService;

    public SocialController(
        SocialClient client,
        IUserService userService,
        IIdentityService identityService,
        IWorkspaceService workspaceService,
        IOrganizationService organizationService,
        IConfiguration configuration,
        ILogger<SsoController> logger,
        IMapper mapper)
    {
        _oauthProviders = configuration
            .GetSection("OAuthProviders")
            .Get<OAuthProvider[]>()?
            .Select(x => x.GetProvider()) ?? Array.Empty<OAuthProvider>();
        
        _client = client;
        _userService = userService;
        _identityService = identityService;
        _workspaceService = workspaceService;
        _organizationService = organizationService;
        _logger = logger;
        _mapper = mapper;
    }

    [HttpPost("login")]
    public async Task<ApiResponse<LoginToken>> Login(LoginBySocial request)
    {
        var (error, provider) = ValidateLoginParam(request.ProviderName);
        if (provider == null)
        {
            return Error<LoginToken>(error);
        }

        try
        {
            // Get access token from code
            var email = await _client.GetEmailAsync(request, provider);

            if (string.IsNullOrWhiteSpace(email))
            {
                return Error<LoginToken>("Can not get email from id_token");
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

                // add new workspace
                await _workspaceService.AddOneAsync(workspace);

                // register user
                var registerResult =
                    await _identityService.RegisterByEmailAsync(workspace.Id, email, string.Empty, UserOrigin.OAuth);
                
                // add new organization
                var organization = new Organization(workspace.Id, "Default Organization");
                await _organizationService.AddOneAsync(organization);

                // add user to organization
                var organizationUser = new OrganizationUser(organization.Id, registerResult.UserId);
                var policies = new[] { BuiltInPolicy.Owner };
                await _organizationService.AddUserAsync(organizationUser, policies);
                
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
            _logger.LogError(ex, "Exception occurred when login by oidc code");

            return Error<LoginToken>(ex.Message);
        }
    }

    [HttpGet("providers")]
    public ApiResponse<IEnumerable<OAuthProviderVm>> Providers()
    {
        var providers = _mapper.Map<IEnumerable<OAuthProviderVm>>(_oauthProviders);

        return Ok(providers);
    }

    private (string error, OAuthProvider?) ValidateLoginParam(string providerName)
    {
        var provider = _oauthProviders?.FirstOrDefault(x => x.Name == providerName);

        return provider == null ? ("Social login is not enabled", null) : (string.Empty, provider);
    }
}