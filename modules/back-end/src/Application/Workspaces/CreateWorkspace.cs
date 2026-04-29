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
        var user = await userService.FindOneAsync(x => x.Email == request.Email);
        if (user != null)
        {
            throw new BusinessException("A user cannot have more than one workspace.");
        }

        var workspace = new Workspace
        {
            Name = "Default Workspace",
            Key = GuidHelper.Encode(Guid.NewGuid()),
        };

        // add new workspace
        await workspaceService.AddOneAsync(workspace);

        // setup free license
        await billingService.CreateFreeLicenseAsync(workspace.Id, request.Email);

        // register user
        var registerResult = await identityService.RegisterByEmailAsync(
            workspace.Id,
            request.Email,
            request.Password,
            request.UserOrigin
        );

        // create default organization
        await mediator.Send(new CreateOrganization
        {
            WorkspaceId = workspace.Id,
            Name = "Default Organization",
            Key = "default-organization",
            CurrentUserId = registerResult.User.Id
        }, cancellationToken);

        return registerResult;
    }
}