using Application.Members;

namespace Application.Users;

public class JoinOrganization : IRequest<bool>
{
    public Guid WorkspaceId { get; set; }

    public Guid OrganizationId { get; set; }
}

public class JoinOrganizationHandler(
    IOrganizationService organizationService,
    IUserService userService,
    ICurrentUser currentUser,
    ISender mediator)
    : IRequestHandler<JoinOrganization, bool>
{
    public async Task<bool> Handle(JoinOrganization request, CancellationToken cancellationToken)
    {
        // Check if the user is already a member of the organization
        var exists = await organizationService.ContainsUserAsync(request.OrganizationId, currentUser.Id);
        if (exists)
        {
            return true;
        }

        var user = await userService.GetAsync(currentUser.Id);

        var addMember = new AddMember
        {
            WorkspaceId = request.WorkspaceId,
            OrganizationId = request.OrganizationId,
            Email = user.Email,
            PolicyIds = [],
            GroupIds = []
        };

        var success = await mediator.Send(addMember, cancellationToken);
        return success;
    }
}