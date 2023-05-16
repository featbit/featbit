using Application.Bases;
using Domain.Organizations;
using Domain.Policies;
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
    private readonly IUserService _userService;
    private readonly IOrganizationService _orgService;
    private readonly ILogger<LoginByEmailHandler> _logger;

    public LoginByEmailHandler(
        IIdentityService identityService,
        IUserService userService,
        IOrganizationService orgService,
        ILogger<LoginByEmailHandler> logger)
    {
        _identityService = identityService;
        _userService = userService;
        _orgService = orgService;
        _logger = logger;
    }

    public async Task<LoginResult> Handle(LoginByEmail request, CancellationToken cancellationToken)
    {
        var user = await _userService.FindByEmailAsync(request.Email);
        if (user == null)
        {
            // create user
            var registerResult = await _identityService.RegisterByEmailAsync(request.Email, request.Password);
            _logger.LogInformation("user {Identity} registered", request.Email);

            // create organization for new user
            var orgName = $"Playground - {request.Email}";
            var organization = new Organization(orgName);
            await _orgService.AddOneAsync(organization);

            // set user as org owner
            var organizationUser = new OrganizationUser(organization.Id, registerResult.UserId);
            var policies = new[] { BuiltInPolicy.Owner };
            await _orgService.AddUserAsync(organizationUser, policies: policies);
            return LoginResult.Ok(registerResult.Token);
        }

        _logger.LogInformation("user {Identity} login by password", request.Email);
        return await _identityService.LoginByEmailAsync(request.Email, request.Password);
    }
}