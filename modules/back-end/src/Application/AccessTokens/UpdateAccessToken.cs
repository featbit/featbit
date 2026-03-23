using Application.Bases;
using Application.Bases.Exceptions;
using Domain.AccessTokens;
using Domain.Policies;

namespace Application.AccessTokens;

public class UpdateAccessToken : IRequest<AccessTokenVm>
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

public class UpdateAccessTokenHandler(IAccessTokenService service, IMapper mapper)
    : IRequestHandler<UpdateAccessToken, AccessTokenVm>
{
    public async Task<AccessTokenVm> Handle(UpdateAccessToken request, CancellationToken cancellationToken)
    {
        var accessTokenWithSameName = await service.FindOneAsync(x =>
            x.OrganizationId == request.OrganizationId &&
            x.Id != request.Id &&
            string.Equals(x.Name.ToLower(), request.Name.ToLower())
        );
        if (accessTokenWithSameName != null)
        {
            throw new BusinessException(ErrorCodes.NameHasBeenUsed);
        }

        var accessToken = await service.GetAsync(request.Id);
        accessToken.Update(request.Name, request.Permissions);
        await service.UpdateAsync(accessToken);

        return mapper.Map<AccessTokenVm>(accessToken);
    }
}