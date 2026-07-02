using Application.Bases;
using Domain.Workspaces;

namespace Application.Workspaces;

public class UpdateOidc : IRequest<WorkspaceVm>
{
    /// <summary>
    /// The ID of the workspace. Retrieved from the request header.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// The OAuth 2.0 client ID
    /// </summary>
    public string ClientId { get; set; }

    /// <summary>
    /// The OAuth 2.0 client secret
    /// </summary>
    public string ClientSecret { get; set; }

    /// <summary>
    /// The token endpoint URL for obtaining access tokens
    /// </summary>
    public string TokenEndpoint { get; set; }

    /// <summary>
    /// The client authentication method (e.g., client_secret_post, client_secret_basic)
    /// </summary>
    public string ClientAuthenticationMethod { get; set; }

    /// <summary>
    /// The authorization endpoint URL for initiating authentication
    /// </summary>
    public string AuthorizationEndpoint { get; set; }

    /// <summary>
    /// The OAuth 2.0 scope to request (space-separated values)
    /// </summary>
    public string Scope { get; set; }

    /// <summary>
    /// The claim name in the ID token that contains the user's email address
    /// </summary>
    public string UserEmailClaim { get; set; }
}

public class UpdateOidcValidator : AbstractValidator<UpdateOidc>
{
    public UpdateOidcValidator()
    {
        RuleFor(x => x.ClientId)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("clientId"));

        RuleFor(x => x.ClientSecret)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("clientSecret"));

        RuleFor(x => x.TokenEndpoint)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("tokenEndpoint"));

        RuleFor(x => x.ClientAuthenticationMethod)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("clientAuthenticationMethod"));

        RuleFor(x => x.AuthorizationEndpoint)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("authorizationEndpoint"));

        RuleFor(x => x.Scope)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("scope"));

        RuleFor(x => x.UserEmailClaim)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("userEmailClaim"));
    }
}

public class UpdateSsoOidcHandler : IRequestHandler<UpdateOidc, WorkspaceVm>
{
    private readonly IWorkspaceService _service;
    private readonly IMapper _mapper;

    public UpdateSsoOidcHandler(IWorkspaceService service, IMapper mapper)
    {
        _service = service;
        _mapper = mapper;
    }

    public async Task<WorkspaceVm> Handle(UpdateOidc request, CancellationToken cancellationToken)
    {
        var workspace = await _service.GetAsync(request.Id);

        var oidcConfig = new OidcConfig
        {
            ClientId = request.ClientId,
            ClientSecret = request.ClientSecret,
            TokenEndpoint = request.TokenEndpoint,
            ClientAuthenticationMethod = request.ClientAuthenticationMethod,
            AuthorizationEndpoint = request.AuthorizationEndpoint,
            Scope = request.Scope,
            UserEmailClaim = request.UserEmailClaim
        };
        workspace.UpdateSsoOidc(oidcConfig);
        await _service.UpdateAsync(workspace);

        return _mapper.Map<WorkspaceVm>(workspace);
    }
}