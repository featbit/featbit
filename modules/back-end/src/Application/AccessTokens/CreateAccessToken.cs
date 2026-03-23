using Application.Bases;
using Application.Bases.Exceptions;
using Application.Users;
using Domain.AccessTokens;
using Domain.Policies;

namespace Application.AccessTokens;

public class CreateAccessToken : IRequest<AccessToken>
{
    public Guid OrganizationId { get; set; }

    public string Name { get; set; }

    public string Type { get; set; }

    public PolicyStatement[] Permissions { get; set; }
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
            .Must(permissions => permissions.Length != 0)
            .Unless(x => x.Type == AccessTokenTypes.Personal)
            .WithErrorCode(ErrorCodes.Invalid("permissions"));
    }
}

public class CreateAccessTokenHandler(IAccessTokenService service, ICurrentUser currentUser)
    : IRequestHandler<CreateAccessToken, AccessToken>
{
    public async Task<AccessToken> Handle(CreateAccessToken request, CancellationToken cancellationToken)
    {
        var isNameUsed = await service.IsNameUsedAsync(request.OrganizationId, request.Name);
        if (isNameUsed)
        {
            throw new BusinessException(ErrorCodes.NameHasBeenUsed);
        }

        var accessToken =
            new AccessToken(request.OrganizationId, currentUser.Id, request.Name, request.Type, request.Permissions);

        await service.AddOneAsync(accessToken);

        return accessToken;
    }
}