using Application.Bases;
using Application.Bases.Exceptions;
using Domain.AccessTokens;
using Domain.Policies;

namespace Application.AccessTokens;

public class UpdateAccessToken : IRequest<AccessTokenEditVm>
{
    public Guid OrganizationId { get; set; }
    
    public Guid Id { get; set; }

    public string Name { get; set; }
    
    public IEnumerable<PolicyStatement> Permissions { get; set; } = [];
}

public class UpdateAccessTokenValidator : AbstractValidator<UpdateAccessToken>
{
    public UpdateAccessTokenValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("name"));
    }
}

public class UpdateAccessTokenHandler : IRequestHandler<UpdateAccessToken, AccessTokenEditVm>
{
    private readonly IAccessTokenService _service;
    private readonly IMapper _mapper;

    public UpdateAccessTokenHandler(IAccessTokenService service, IMapper mapper)
    {
        _service = service;
        _mapper = mapper;
    }

    public async Task<AccessTokenEditVm> Handle(UpdateAccessToken request, CancellationToken cancellationToken)
    {
        var accessTokenWithSameName = await _service.FindOneAsync(x => x.OrganizationId == request.OrganizationId && x.Id != request.Id && string.Equals(x.Name.ToLower(), request.Name.ToLower()));

        if (accessTokenWithSameName != null)
        {
            throw new BusinessException(ErrorCodes.NameHasBeenUsed);
        }

        var accessToken = await _service.FindOneAsync(x => x.OrganizationId == request.OrganizationId && x.Id == request.Id);
        accessToken.UpdateName(request.Name);
        if (accessToken.Type == AccessTokenTypes.Service)
        {
            accessToken.Permissions = request.Permissions.Where(p => p != null).ToArray();
        }

        await _service.UpdateAsync(accessToken);

        return _mapper.Map<AccessTokenEditVm>(accessToken);
    }
}