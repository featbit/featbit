using Application.Bases.Exceptions;
using Application.Identity;
using Application.Organizations;
using Domain.Utils;
using Domain.Workspaces;

namespace Application.Workspaces;

public class CreateWorkspace : IRequest<RegisterResult>
{
    public string Email { get; set; }

    public string Password { get; set; }

    public string UserOrigin { get; set; }
}

public class CreateWorkspaceHandler : IRequestHandler<CreateWorkspace, RegisterResult>
{
    private readonly IWorkspaceService _workspaceService;
    private readonly IUserService _userService;
    private readonly IIdentityService _identityService;
    private readonly ISender _mediator;

    public CreateWorkspaceHandler(
        IWorkspaceService workspaceService,
        IUserService userService,
        IIdentityService identityService,
        ISender mediator)
    {
        _workspaceService = workspaceService;
        _userService = userService;
        _identityService = identityService;
        _mediator = mediator;
    }

    public async Task<RegisterResult> Handle(CreateWorkspace request, CancellationToken cancellationToken)
    {
        var user = await _userService.FindOneAsync(x => x.Email == request.Email);
        if (user != null)
        {
            throw new BusinessException("A user cannot have more than one workspace.");
        }

        var workspace = new Workspace
        {
            Name = "Default Workspace",
            Key = GuidHelper.Encode(Guid.NewGuid())
        };

        // add new workspace
        await _workspaceService.AddOneAsync(workspace);

        // register user
        var registerResult = await _identityService.RegisterByEmailAsync(
            workspace.Id,
            request.Email,
            request.Password,
            request.UserOrigin
        );

        // create default organization
        await _mediator.Send(new CreateOrganization
        {
            WorkspaceId = workspace.Id,
            Name = "Default Organization",
            CurrentUserId = registerResult.UserId
        }, cancellationToken);

        return registerResult;
    }
}