using Application.Bases;
using Application.Users;
using Domain.Organizations;
using Domain.Policies;
using Domain.Users;

namespace Application.Organizations;

public class AddUser : IRequest<bool>
{
    public string Method { get; set; }

    public Guid WorkspaceId { get; set; }

    public Guid OrganizationId { get; set; }

    public string Email { get; set; }

    public ICollection<Guid> PolicyIds { get; set; } = Array.Empty<Guid>();

    public ICollection<Guid> GroupIds { get; set; } = Array.Empty<Guid>();
}

public class AddUserValidator : AbstractValidator<AddUser>
{
    public AddUserValidator()
    {
        RuleFor(x => x.Method)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("method"))
            .Equal(x => "Email").WithErrorCode(ErrorCodes.Invalid("method"));

        RuleFor(x => x.Email)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("email"))
            .EmailAddress().WithErrorCode(ErrorCodes.Invalid("email"));
    }
}

public class AddUserHandler : IRequestHandler<AddUser, bool>
{
    private readonly IOrganizationService _organizationService;
    private readonly IUserService _userService;
    private readonly IIdentityService _identityService;
    private readonly ICurrentUser _currentUser;

    public AddUserHandler(
        IOrganizationService organizationService,
        IUserService userService,
        IIdentityService identityService,
        ICurrentUser currentUser)
    {
        _organizationService = organizationService;
        _userService = userService;
        _currentUser = currentUser;
        _identityService = identityService;
    }

    public async Task<bool> Handle(AddUser request, CancellationToken cancellationToken)
    {
        var email = request.Email;

        string initialPwd;
        Guid userId;

        var user = await _userService.FindOneAsync(x => x.Email == email && x.WorkspaceId == request.WorkspaceId);
        // automatically register users if they do not exist
        if (user == null)
        {
            initialPwd = PasswordGenerator.New(email);
            var registerResult =
                await _identityService.RegisterByEmailAsync(request.WorkspaceId, email, initialPwd, UserOrigin.Local);
            userId = registerResult.UserId;
        }
        else
        {
            initialPwd = string.Empty;
            userId = user.Id;
        }

        // if no policies or groups are specified, give user the Developer policy
        if (!request.PolicyIds.Any() && !request.GroupIds.Any())
        {
            request.PolicyIds = new[] { BuiltInPolicy.Developer };
        }

        var organizationUser = new OrganizationUser(request.OrganizationId, userId, _currentUser.Id, initialPwd);
        await _organizationService.AddUserAsync(
            organizationUser,
            request.PolicyIds,
            request.GroupIds
        );

        return true;
    }
}