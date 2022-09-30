using Application.Bases;

namespace Application.Users;

public class UpdateProfile : IRequest<Profile>
{
    public string Email { get; set; }
}

public class UpdateProfileValidator : AbstractValidator<UpdateProfile>
{
    public UpdateProfileValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithErrorCode(ErrorCodes.EmailIsRequired)
            .EmailAddress().WithErrorCode(ErrorCodes.EmailIsInvalid);
    }
}

public class UpdateProfileHandler : IRequestHandler<UpdateProfile, Profile>
{
    private readonly IUserService _service;
    private readonly ICurrentUser _currentUser;

    public UpdateProfileHandler(IUserService service, ICurrentUser currentUser)
    {
        _service = service;
        _currentUser = currentUser;
    }
    
    public async Task<Profile> Handle(UpdateProfile request, CancellationToken cancellationToken)
    {
        var user = await _service.GetAsync(_currentUser.Id);

        user.Update(request.Email);

        await _service.UpdateAsync(user);

        return new Profile(user);
    }
}