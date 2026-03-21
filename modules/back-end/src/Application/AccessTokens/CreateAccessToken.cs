using Application.Bases;
using Application.Bases.Exceptions;
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
            .NotEmpty().WithErrorCode(ErrorCodes.Required("name"));

        RuleFor(x => x.Type)
            .Must(AccessTokenTypes.IsDefined).WithErrorCode(ErrorCodes.Invalid("type"));

        RuleFor(x => x.Permissions)
            .Must(permissions => permissions.Any())
            .Unless(x => x.Type == AccessTokenTypes.Personal)
            .WithErrorCode(ErrorCodes.Invalid("permissions"));
    }
}

public class CreateAccessTokenHandler : IRequestHandler<CreateAccessToken, AccessTokenVm>
{
    private readonly ICurrentUser _currentUser;
    private readonly IAccessTokenService _service;
    private readonly IMapper _mapper;

    public CreateAccessTokenHandler(
        IAccessTokenService service,
        IMemberService memberService,
        ICurrentUser currentUser,
        IMapper mapper)
    {
        _service = service;
        _currentUser = currentUser;
        _mapper = mapper;
    }

    public async Task<AccessTokenVm> Handle(CreateAccessToken request, CancellationToken cancellationToken)
    {
        var isNameUsed = await _service.IsNameUsedAsync(request.OrganizationId, request.Name);
        if (isNameUsed)
        {
            throw new BusinessException(ErrorCodes.NameHasBeenUsed);
        }

        var accessToken =
            new AccessToken(request.OrganizationId, _currentUser.Id, request.Name, request.Type, request.Permissions);

        await _service.AddOneAsync(accessToken);

        return _mapper.Map<AccessTokenVm>(accessToken);
    }
}