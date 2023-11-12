using Application.Bases;
using Application.Caches;
using Domain.Workspaces;

namespace Application.Workspaces;

public class UpdateSsoOidc : IRequest<WorkspaceVm>
{
    public Guid Id { get; set; }

    public string ClientId { get; set; }
    
    public string ClientSecret { get; set; }
    
    public string TokenEndpoint { get; set; }
    
    public string ClientAuthenticationMethod { get; set; }
    
    public string AuthorizationEndpoint { get; set; }
    
    public string Scope { get; set; }
    
    public string UserEmailClaim { get; set; }
}

public class UpdateSsoOidcValidator : AbstractValidator<UpdateSsoOidc>
{
    public UpdateSsoOidcValidator()
    {
        RuleFor(x => x.ClientId)
            .NotEmpty().WithErrorCode(ErrorCodes.ClientIdRequired);
        
        RuleFor(x => x.ClientSecret)
            .NotEmpty().WithErrorCode(ErrorCodes.ClientSecretRequired);
        
        RuleFor(x => x.TokenEndpoint)
            .NotEmpty().WithErrorCode(ErrorCodes.TokenEndpointRequired);
        
        RuleFor(x => x.ClientAuthenticationMethod)
            .NotEmpty().WithErrorCode(ErrorCodes.ClientAuthenticationMethodRequired);
        
        RuleFor(x => x.AuthorizationEndpoint)
            .NotEmpty().WithErrorCode(ErrorCodes.AuthorizationEndpointRequired);
        
        RuleFor(x => x.Scope)
            .NotEmpty().WithErrorCode(ErrorCodes.ScopeRequired);
        
        RuleFor(x => x.UserEmailClaim)
            .NotEmpty().WithErrorCode(ErrorCodes.UserEmailClaimRequired);
    }
}

public class UpdateSsoOidcHandler : IRequestHandler<UpdateSsoOidc, WorkspaceVm>
{
    private readonly IWorkspaceService _service;
    private readonly IMapper _mapper;

    public UpdateSsoOidcHandler(IWorkspaceService service, IMapper mapper)
    {
        _service = service;
        _mapper = mapper;
    }

    public async Task<WorkspaceVm> Handle(UpdateSsoOidc request, CancellationToken cancellationToken)
    {
        var workspace = await _service.GetAsync(request.Id);

        // save to database
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