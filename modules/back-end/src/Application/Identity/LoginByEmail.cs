using Application.Bases;
using Microsoft.Extensions.Logging;

namespace Application.Identity;

public class LoginByEmail : IRequest<LoginResult>
{
    public string Email { get; init; } = string.Empty;

    public string WorkspaceKey { get; set; } = string.Empty;

    public string Password { get; init; } = string.Empty;
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

public class LoginByEmailHandler : IRequestHandler<LoginByEmail, LoginResult>
{
    private readonly IUserService _userService;
    private readonly IIdentityService _identityService;
    private readonly ILogger<LoginByEmailHandler> _logger;

    public LoginByEmailHandler(
        IUserService userService,
        IIdentityService identityService,
        ILogger<LoginByEmailHandler> logger)
    {
        _userService = userService;
        _identityService = identityService;
        _logger = logger;
    }

    public async Task<LoginResult> Handle(LoginByEmail request, CancellationToken cancellationToken)
    {
        _logger.LogInformation("user {Identity} login in by password", request.Email);

        var workspaces = await _userService.GetWorkspacesAsync(request.Email);
        var workspaceId = workspaces.Count switch
        {
            // if user has no workspace
            0 => null,

            // if user has only one workspace and no workspace key is specified in the request
            1 when string.IsNullOrWhiteSpace(request.WorkspaceKey) => workspaces.First().Id,

            // if workspace key is specified in the request
            _ => workspaces.FirstOrDefault(x => x.Key == request.WorkspaceKey)?.Id
        };

        return await _identityService.LoginByEmailAsync(workspaceId, request.Email, request.Password);
    }
}