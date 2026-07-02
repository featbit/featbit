using Application.Bases;

namespace Application.Identity;

public class LoginByEmail : IRequest<LoginResult>
{
    public string Email { get; init; } = string.Empty;

    public string Password { get; init; } = string.Empty;

    public string IpAddress { get; set; } = string.Empty;
}

public class LoginByEmailValidator : AbstractValidator<LoginByEmail>
{
    public LoginByEmailValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("email"))
            .EmailAddress().WithErrorCode(ErrorCodes.Invalid("email"));

        RuleFor(x => x.Password)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("password"));
    }
}

public class LoginByEmailHandler(IIdentityService identityService) : IRequestHandler<LoginByEmail, LoginResult>
{
    public async Task<LoginResult> Handle(LoginByEmail request, CancellationToken cancellationToken) =>
        await identityService.LoginByEmailAsync(request.Email, request.Password, request.IpAddress);
}