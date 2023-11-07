using Application.Bases;

namespace Application.Identity;

public class HasMultipleAccounts : IRequest<bool>
{
    public string Email { get; init; } = string.Empty;
}

public class HasMultipleAccountsValidator : AbstractValidator<HasMultipleAccounts>
{
    public HasMultipleAccountsValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithErrorCode(ErrorCodes.EmailIsRequired)
            .EmailAddress().WithErrorCode(ErrorCodes.EmailIsInvalid);
    }
}

public class HasMultipleAccountsHandler : IRequestHandler<HasMultipleAccounts, bool>
{
    private readonly IAccountService _accountService;

    public HasMultipleAccountsHandler(
        IAccountService accountService)
    {
        _accountService = accountService;
    }

    public async Task<bool> Handle(HasMultipleAccounts request, CancellationToken cancellationToken)
    {
        var accounts = await _accountService.GetByEmailAsync(request.Email);
        
        return accounts.Count() > 1;
    }
}