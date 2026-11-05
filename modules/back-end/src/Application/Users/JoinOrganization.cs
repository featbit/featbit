using Application.Members;
using Application.Bases.Exceptions;

namespace Application.Users;

public class JoinOrganization : IRequest<bool>
{
    public Guid WorkspaceId { get; set; }

    public Guid OrganizationId { get; set; }
}

public class JoinOrganizationHandler(
    IUserService userService,
    ICurrentUser currentUser,
    ISsoOrganizationJoinAuthorization authorization,
    ISender mediator)
    : IRequestHandler<JoinOrganization, bool>
{
    public async Task<bool> Handle(JoinOrganization request, CancellationToken cancellationToken)
    {
        var decision = await authorization.GetJoinAuthorizationAsync(request.WorkspaceId, request.OrganizationId, currentUser.Id);
        if (!decision.IsAllowed)
        {
            throw new ForbiddenException();
        }

        // Check if the user is already a member of the organization
        if (decision.IsAlreadyMember)
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
