using Application.Bases;
using Application.Users;
using Domain.Organizations;
using Domain.Users;

namespace Application.Organizations;

public class AddUser : IRequest<bool>
{
    public Guid WorkspaceId { get; set; }

    public Guid OrganizationId { get; set; }

    public string Email { get; set; }

    public ICollection<Guid> PolicyIds { get; set; } = [];

    public ICollection<Guid> GroupIds { get; set; } = [];
}

public class AddUserValidator : AbstractValidator<AddUser>
{
    public AddUserValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("email"))
            .EmailAddress().WithErrorCode(ErrorCodes.Invalid("email"));
    }
}

public class AddUserHandler(
    IOrganizationService organizationService,
    IUserService userService,
    IIdentityService identityService,
    ICurrentUser currentUser)
    : IRequestHandler<AddUser, bool>
{
    public async Task<bool> Handle(AddUser request, CancellationToken cancellationToken)
    {
        var email = request.Email;

        string initialPwd;
        Guid userId;

        var user = await userService.FindOneAsync(x => x.Email == email && x.WorkspaceId == request.WorkspaceId);
        // automatically register users if they do not exist
        if (user == null)
        {
            initialPwd = PasswordGenerator.New(email);
            var registerResult =
                await identityService.RegisterByEmailAsync(request.WorkspaceId, email, initialPwd, UserOrigin.Local);
            userId = registerResult.UserId;
        }
        else
        {
            initialPwd = string.Empty;
            userId = user.Id;
        }

        // if no policies or groups are specified, use the organization's default permissions
        if (!request.PolicyIds.Any() && !request.GroupIds.Any())
        {
            var organization = await organizationService.GetAsync(request.OrganizationId);
            request.PolicyIds = organization.DefaultPermissions.PolicyIds;
            request.GroupIds = organization.DefaultPermissions.GroupIds;
        }

        var organizationUser = new OrganizationUser(request.OrganizationId, userId, currentUser.Id, initialPwd);
        await organizationService.AddUserAsync(
            organizationUser,
            request.PolicyIds,
            request.GroupIds
        );

        return true;
    }
}