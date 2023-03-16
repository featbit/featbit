using Application.Bases;
using Application.Policies;
using Application.Users;
using Domain.AccessTokens;
using Domain.Policies;

namespace Application.AccessTokens;

public class CreateAccessToken : IRequest<AccessTokenVm>
{
    public Guid OrganizationId { get; set; }

    public string Name { get; set; }

    public string Type { get; set; }

    public IEnumerable<PolicyStatement> Permissions { get; set; }
}

public class CreateAccessTokenValidator : AbstractValidator<CreateAccessToken>
{
    public CreateAccessTokenValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.NameIsRequired);
        
        RuleFor(x => x.Type)
            .Must(AccessTokenTypes.IsDefined).WithErrorCode(ErrorCodes.InvalidAccessTokenType);
        
        RuleFor(x => x.Permissions)
            .Must(Permissions => Permissions.Any())
            .Unless(x => x.Type == AccessTokenTypes.Personal)
            .WithErrorCode(ErrorCodes.ServiceAccessTokenMustDefinePolicies);
    }
}

public class CreateAccessTokenHandler : IRequestHandler<CreateAccessToken, AccessTokenVm>
{
    private readonly IPolicyService _policyService;
    private readonly ICurrentUser _currentUser;
    private readonly IAccessTokenService _service;
    private readonly IMapper _mapper;

    public CreateAccessTokenHandler(IAccessTokenService service, IPolicyService policyService, ICurrentUser currentUser, IMapper mapper)
    {
        _service = service;
        _currentUser = currentUser;
        _policyService = policyService;
        _mapper = mapper;
    }

    public async Task<AccessTokenVm> Handle(CreateAccessToken request, CancellationToken cancellationToken)
    {
        var permissions = request.Permissions;
        if (request.Type == AccessTokenTypes.Service)
        {
            // TODO check currentUser has all the permissions
        }
        
        var accessToken = new AccessToken(request.OrganizationId, _currentUser.Id, request.Name, request.Type, permissions);

        await _service.AddOneAsync(accessToken);

        return _mapper.Map<AccessTokenVm>(accessToken);
    }
}