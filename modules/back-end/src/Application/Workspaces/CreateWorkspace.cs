using Application.Bases.Exceptions;
using Application.Identity;
using Application.Organizations;
using Domain.Users;
using Domain.Utils;
using Domain.Workspaces;

namespace Application.Workspaces;

public class CreateWorkspace : IRequest<RegisterResult>
{
    public string Email { get; set; }

    public string Password { get; set; }

    public string UserOrigin { get; set; }
}

public class CreateWorkspaceHandler(
    IWorkspaceService workspaceService,
    IBillingService billingService,
    IUserService userService,
    IIdentityService identityService,
    ISender mediator)
    : IRequestHandler<CreateWorkspace, RegisterResult>
{
    public async Task<RegisterResult> Handle(CreateWorkspace request, CancellationToken cancellationToken)
    {
        var registerResult = await identityService.RegisterByEmailAsync(
            request.Email,
            request.Password,
            request.UserOrigin
        );

        var workspace = new Workspace
        {
            Name = "Default Workspace",
            Key = GuidHelper.Encode(Guid.NewGuid())
        };

        // add new workspace
        await workspaceService.AddOneAsync(workspace);
        
        var workspaceUser = new WorkspaceUser(workspace.Id, registerResult.User.Id);
        // Nothing will happen if user already in the workspace
        await workspaceService.AddUserAsync(workspaceUser);

        // create default organization
        await mediator.Send(new CreateOrganization
        {
            WorkspaceId = workspace.Id,
            Name = "Default Organization",
            Key = "default-organization",
            CurrentUserId = registerResult.User.Id
        }, cancellationToken);

        // setup free license
        await billingService.CreateFreeLicenseAsync(workspace.Id, request.Email);
        
        return registerResult;
    }
}