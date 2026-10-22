using Application.AuditLogs;
using Domain.AuditLogs;

using Application.Bases;

namespace Application.Users;

public class UpdateProfile : IRequest<Profile>
{
    public string Name { get; set; }
    public string Email { get; set; }
}

public class UpdateProfileValidator : AbstractValidator<UpdateProfile>
{
    public UpdateProfileValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("email"))
            .EmailAddress().WithErrorCode(ErrorCodes.Invalid("email"));
    }
}

public class UpdateProfileHandler : IRequestHandler<UpdateProfile, Profile>
{
    private readonly IOrganizationService _organizations;
    private readonly IPublisher _publisher;
    private readonly IUserService _service;
    private readonly ICurrentUser _currentUser;

    public UpdateProfileHandler(IUserService service, ICurrentUser currentUser, IOrganizationService organizations, IPublisher publisher)
    {
        _organizations = organizations;
        _publisher = publisher;
        _service = service;
        _currentUser = currentUser;
    }

    public async Task<Profile> Handle(UpdateProfile request, CancellationToken cancellationToken)
    {
        var user = await _service.GetAsync(_currentUser.Id);

        var workspaces = await _service.GetWorkspacesAsync(user.Id);
        var owners = new HashSet<(Guid WorkspaceId, Guid? OrganizationId)>();
        foreach (var workspace in workspaces)
        {
            var organizations = await _organizations.GetUserOrganizationsAsync(workspace.Id, user.Id);
            if (organizations.Count == 0) owners.Add((workspace.Id, null));
            foreach (var organization in organizations) owners.Add((workspace.Id, organization.Id));
        }
        var previous = new ProfileAuditSnapshot(user.Id, user.Name, $"member/{user.Email}", user.Email);
        var change = new DataChange(previous);
        user.Update(request.Email, request.Name);

        await _service.UpdateAsync(user);

        var current = new ProfileAuditSnapshot(user.Id, user.Name, $"member/{user.Email}", user.Email);
        foreach (var owner in owners)
        {
            await _publisher.Publish(new OnIamResourceChanged(owner.WorkspaceId, owner.OrganizationId,
                AuditLogRefTypes.Member, Operations.UpdateProfile, current, change.To(current), _currentUser.Id), cancellationToken);
        }
        return new Profile(user);
    }
}
