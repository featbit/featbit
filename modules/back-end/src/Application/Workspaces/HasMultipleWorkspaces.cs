using Application.Bases;

namespace Application.Workspaces;

public class HasMultipleWorkspaces : IRequest<bool>
{
    public string Email { get; init; } = string.Empty;
}

public class HasMultipleWorkspacesValidator : AbstractValidator<HasMultipleWorkspaces>
{
    public HasMultipleWorkspacesValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithErrorCode(ErrorCodes.EmailIsRequired)
            .EmailAddress().WithErrorCode(ErrorCodes.EmailIsInvalid);
    }
}

public class HasMultipleWorkspacesHandler : IRequestHandler<HasMultipleWorkspaces, bool>
{
    private readonly IWorkspaceService _workspaceService;

    public HasMultipleWorkspacesHandler(
        IWorkspaceService workspaceService)
    {
        _workspaceService = workspaceService;
    }

    public async Task<bool> Handle(HasMultipleWorkspaces request, CancellationToken cancellationToken)
    {
        var workspaces = await _workspaceService.GetByEmailAsync(request.Email);
        
        return workspaces.Count() > 1;
    }
}