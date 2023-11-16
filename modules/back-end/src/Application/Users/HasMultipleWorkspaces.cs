using Application.Bases;

namespace Application.Users;

public class HasMultipleWorkspaces : IRequest<bool>
{
    public string Email { get; init; } = string.Empty;
}

public class HasMultipleWorkspacesValidator : AbstractValidator<HasMultipleWorkspaces>
{
    public HasMultipleWorkspacesValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("email"))
            .EmailAddress().WithErrorCode(ErrorCodes.Invalid("email"));
    }
}

public class HasMultipleWorkspacesHandler : IRequestHandler<HasMultipleWorkspaces, bool>
{
    private readonly IUserService _service;

    public HasMultipleWorkspacesHandler(IUserService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(HasMultipleWorkspaces request, CancellationToken cancellationToken)
    {
        var workspaces = await _service.GetWorkspacesAsync(request.Email);
        return workspaces.Count > 1;
    }
}