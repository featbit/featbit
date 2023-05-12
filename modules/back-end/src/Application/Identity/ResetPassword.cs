using Application.Bases;
using Application.Users;

namespace Application.Identity;

public class ResetPassword : IRequest<ResetPasswordResult>
{
    public string CurrentPassword { get; set; }

    public string NewPassword { get; set; }
}

public class ResetPasswordValidator : AbstractValidator<ResetPassword>
{
    public ResetPasswordValidator()
    {
        RuleFor(x => x.NewPassword)
            .MinimumLength(6).WithErrorCode(ErrorCodes.PasswordTooShort);
    }
}

public class ResetPasswordHandler : IRequestHandler<ResetPassword, ResetPasswordResult>
{
    private readonly IUserService _userService;
    private readonly IIdentityService _identityService;
    private readonly ICurrentUser _currentUser;

    public ResetPasswordHandler(IUserService userService, IIdentityService identityService, ICurrentUser currentUser)
    {
        _userService = userService;
        _identityService = identityService;
        _currentUser = currentUser;
    }

    public async Task<ResetPasswordResult> Handle(ResetPassword request, CancellationToken cancellationToken)
    {
        var user = await _userService.GetAsync(_currentUser.Id);
        if (!await _identityService.CheckPasswordAsync(user, request.CurrentPassword))
        {
            return ResetPasswordResult.Failed(ErrorCodes.PasswordMismatch);
        }

        await _identityService.ResetPasswordAsync(user, request.NewPassword);
        return ResetPasswordResult.Ok();
    }
}