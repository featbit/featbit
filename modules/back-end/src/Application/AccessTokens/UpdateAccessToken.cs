using Application.Bases;

namespace Application.AccessTokens;

public class UpdateAccessToken : IRequest<bool>
{
    public Guid Id { get; set; }

    public string Name { get; set; }
}

public class UpdateAccessTokenValidator : AbstractValidator<UpdateAccessToken>
{
    public UpdateAccessTokenValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.NameIsRequired);
    }
}

public class UpdateAccessTokenHandler : IRequestHandler<UpdateAccessToken, bool>
{
    private readonly IAccessTokenService _service;

    public UpdateAccessTokenHandler(IAccessTokenService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(UpdateAccessToken request, CancellationToken cancellationToken)
    {
        var accessToken = await _service.GetAsync(request.Id);
        accessToken.UpdateName(request.Name);

        await _service.UpdateAsync(accessToken);

        return true;
    }
}