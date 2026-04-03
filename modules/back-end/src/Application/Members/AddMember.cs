using Application.Bases;
using Application.Users;
using Domain.Organizations;
using Domain.Users;

namespace Application.Members;

public class AddMember : IRequest<bool>
{
    /// <summary>
    /// The ID of the workspace to which the user belongs. Retrieved from the request header.
    /// </summary>
    public Guid WorkspaceId { get; set; }

    /// <summary>
    /// The ID of the organization to which the user will be added. Retrieved from the request header.
    /// </summary>
    public Guid OrganizationId { get; set; }

    /// <summary>
    /// The email of the user to be added to the organization.
    /// </summary>
    public string Email { get; set; }

    /// <summary>
    /// The IDs of the initial policies to assign to the user.
    /// </summary>
    public ICollection<Guid> PolicyIds { get; set; } = [];

    /// <summary>
    /// The IDs of the initial groups to assign to the user.
    /// </summary>
    public ICollection<Guid> GroupIds { get; set; } = [];
}

public class AddMemberValidator : AbstractValidator<AddMember>
{
    public AddMemberValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("email"))
            .EmailAddress().WithErrorCode(ErrorCodes.Invalid("email"));
    }
}

public class AddMemberHandler(
    IOrganizationService organizationService,
    IUserService userService,
    IIdentityService identityService,
    ICurrentUser currentUser)
    : IRequestHandler<AddMember, bool>
{
    public async Task<bool> Handle(AddMember request, CancellationToken cancellationToken)
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
            userId = registerResult.User.Id;
        }
        else
        {
            initialPwd = string.Empty;
            userId = user.Id;
        }

        // if no policies or groups are specified, use the organization's default permissions
        if (request.PolicyIds.Count == 0 && request.GroupIds.Count == 0)
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