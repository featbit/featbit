using Application.Bases;
using Application.Services;
using Microsoft.Extensions.Logging;

namespace Application.Identity;

public record LoginByPassword : IRequest<LoginResult>
{
    public string Identity { get; init; } = string.Empty;

    public string Password { get; init; } = string.Empty;
}

public class LoginByPasswordValidator : AbstractValidator<LoginByPassword>
{
    public LoginByPasswordValidator()
    {
        RuleFor(x => x.Identity)
            .NotEmpty().WithErrorCode(ErrorCodes.IdentityIsRequired);

        RuleFor(x => x.Password)
            .NotEmpty().WithErrorCode(ErrorCodes.PasswordIsRequired);
    }
}

public class LoginByPasswordHandler : IRequestHandler<LoginByPassword, LoginResult>
{
    private readonly IIdentityService _identityService;
    private readonly ILogger<LoginByPasswordHandler> _logger;

    public LoginByPasswordHandler(
        IIdentityService identityService,
        ILogger<LoginByPasswordHandler> logger)
    {
        _identityService = identityService;
        _logger = logger;
    }

    public async Task<LoginResult> Handle(LoginByPassword request, CancellationToken cancellationToken)
    {
        _logger.LogInformation("user {Identity} login in by password", request.Identity);

        return await _identityService.LoginByPasswordAsync(request.Identity, request.Password);
    }
}