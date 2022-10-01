namespace Application.Users;

public class GetProfile : IRequest<Profile>
{
}

public class GetProfileHandler : IRequestHandler<GetProfile, Profile>
{
    private readonly IUserService _userService;
    private readonly ICurrentUser _currentUser;

    public GetProfileHandler(IUserService userService, ICurrentUser currentUser)
    {
        _userService = userService;
        _currentUser = currentUser;
    }

    public async Task<Profile> Handle(GetProfile request, CancellationToken cancellationToken)
    {
        var user = await _userService.GetAsync(_currentUser.Id);

        return new Profile(user);
    }
}