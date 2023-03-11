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

    public IEnumerable<Guid> PolicyIds { get; set; }
}

public class CreateAccessTokenValidator : AbstractValidator<CreateAccessToken>
{
    public CreateAccessTokenValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.NameIsRequired);
        
        RuleFor(x => x.Type)
            .Must(AccessTokenTypes.IsDefined).WithErrorCode(ErrorCodes.InvalidAccessTokenType);
        
        RuleFor(x => x.PolicyIds)
            .Must(PolicyIds => PolicyIds.Any())
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
        var policies = Enumerable.Empty<Policy>();
        if (request.Type == AccessTokenTypes.Service)
        {
            policies = await _policyService.FindManyAsync((x) => request.PolicyIds.Contains(x.Id));
        }
        
        var accessToken = new AccessToken(request.OrganizationId, _currentUser.Id, request.Name, request.Type, policies);

        await _service.AddOneAsync(accessToken);

        return _mapper.Map<AccessTokenVm>(accessToken);
    }
}