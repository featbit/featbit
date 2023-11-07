using Application.Bases;
using Microsoft.Extensions.Logging;

namespace Application.Identity;

public class LoginByEmail : IRequest<LoginResult>
{
    public string Email { get; init; } = string.Empty;

    public string AccountKey { get; set; }

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
    private readonly IAccountService _accountService;
    private readonly ILogger<LoginByEmailHandler> _logger;

    public LoginByEmailHandler(
        IIdentityService identityService,
        IAccountService accountService,
        ILogger<LoginByEmailHandler> logger)
    {
        _identityService = identityService;
        _accountService = accountService;
        _logger = logger;
    }

    public async Task<LoginResult> Handle(LoginByEmail request, CancellationToken cancellationToken)
    {
        _logger.LogInformation("user {Identity} login in by password", request.Email);

        var accounts = await _accountService.GetByEmailAsync(request.Email);
        var accountId = accounts.FirstOrDefault(x => x.Key == request.AccountKey && !string.IsNullOrEmpty(request.AccountKey))?.Id;

        if (!accountId.HasValue && accounts.Count() == 1)
        {
            accountId = accounts.First().Id;
        }
        
        if (!accountId.HasValue)
        {
            return LoginResult.Failed(ErrorCodes.EmailPasswordMismatch);
        }
        
        return await _identityService.LoginByEmailAsync(request.Email, request.Password, accountId.Value);
    }
}