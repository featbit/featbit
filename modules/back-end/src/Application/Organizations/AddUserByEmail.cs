using Application.Bases;
using Application.Users;
using Domain.Organizations;
using Domain.Users;

namespace Application.Organizations;

public class AddUserByEmail : IRequest<bool>
{
    public Guid OrganizationId { get; set; }

    public string Email { get; set; }

    public ICollection<Guid> PolicyIds { get; set; }

    public ICollection<Guid> GroupIds { get; set; }
}

public class AddUserByEmailValidator : AbstractValidator<AddUserByEmail>
{
    public AddUserByEmailValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithErrorCode(ErrorCodes.EmailIsRequired)
            .EmailAddress().WithErrorCode(ErrorCodes.EmailIsInvalid);
    }
}

public class AddUserByEmailHandler : IRequestHandler<AddUserByEmail, bool>
{
    private readonly IOrganizationService _organizationService;
    private readonly IUserService _userService;
    private readonly IIdentityService _identityService;
    private readonly ICurrentUser _currentUser;

    public AddUserByEmailHandler(
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

    public async Task<bool> Handle(AddUserByEmail request, CancellationToken cancellationToken)
    {
        var email = request.Email;
        
        string initialPwd;
        Guid userId;
        
        var user = await _userService.FindByEmailAsync(email);
        // automatically register users if they do not exist
        if (user == null)
        {
            initialPwd = PasswordGenerator.New(email);
            var registerResult = await _identityService.RegisterByEmailAsync(email, initialPwd);
            userId = registerResult.UserId;
        }
        else
        {
            initialPwd = string.Empty;
            userId = user.Id;
        }

        var organizationUser = new OrganizationUser(request.OrganizationId, userId, _currentUser.Id, initialPwd);
        await _organizationService.AddUserAsync(
            organizationUser,
            request.GroupIds,
            request.PolicyIds
        );

        return true;
    }
}