using Application.Bases;
using Microsoft.Extensions.Logging;

namespace Application.Identity;

public class LoginByEmail : IRequest<LoginResult>
{
    public string Email { get; init; } = string.Empty;

    public string WorkspaceKey { get; set; }

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
    private readonly IWorkspaceService _workspaceService;
    private readonly ILogger<LoginByEmailHandler> _logger;

    public LoginByEmailHandler(
        IIdentityService identityService,
        IWorkspaceService workspaceService,
        ILogger<LoginByEmailHandler> logger)
    {
        _identityService = identityService;
        _workspaceService = workspaceService;
        _logger = logger;
    }

    public async Task<LoginResult> Handle(LoginByEmail request, CancellationToken cancellationToken)
    {
        _logger.LogInformation("user {Identity} login in by password", request.Email);

        var workspaces = await _workspaceService.GetByEmailAsync(request.Email);
        var workspaceId = workspaces.FirstOrDefault(x => x.Key == request.WorkspaceKey && !string.IsNullOrEmpty(request.WorkspaceKey))?.Id;

        if (!workspaceId.HasValue && workspaces.Count() == 1)
        {
            workspaceId = workspaces.First().Id;
        }
        
        if (!workspaceId.HasValue)
        {
            return LoginResult.Failed(ErrorCodes.EmailPasswordMismatch);
        }
        
        return await _identityService.LoginByEmailAsync(request.Email, request.Password, workspaceId.Value);
    }
}