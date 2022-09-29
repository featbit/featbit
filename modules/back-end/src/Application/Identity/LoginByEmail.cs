using Application.Bases;
using Microsoft.Extensions.Logging;

namespace Application.Identity;

public class LoginByEmail : IRequest<LoginResult>
{
    public string Email { get; init; } = string.Empty;

    public string Password { get; init; } = string.Empty;
}

public class LoginByEmailValidator : AbstractValidator<LoginByEmail>
{
    public LoginByEmailValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithErrorCode(ErrorCodes.EmailIsRequired)
            .EmailAddress().WithErrorCode(ErrorCodes.EmailIsInvalid);

        RuleFor(x => x.Password)
            .NotEmpty().WithErrorCode(ErrorCodes.PasswordIsRequired);
    }
}

public class LoginByEmailHandler : IRequestHandler<LoginByEmail, LoginResult>
{
    private readonly IIdentityService _identityService;
    private readonly ILogger<LoginByEmailHandler> _logger;

    public LoginByEmailHandler(
        IIdentityService identityService,
        ILogger<LoginByEmailHandler> logger)
    {
        _identityService = identityService;
        _logger = logger;
    }

    public async Task<LoginResult> Handle(LoginByEmail request, CancellationToken cancellationToken)
    {
        _logger.LogInformation("user {Identity} login in by password", request.Email);

        return await _identityService.LoginByEmailAsync(request.Email, request.Password);
    }
}