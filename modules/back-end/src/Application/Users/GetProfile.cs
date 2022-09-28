namespace Application.Users;

public class GetProfile : IRequest<Profile>
{
    public Guid Id { get; set; }
}

public class GetProfileHandler : IRequestHandler<GetProfile, Profile>
{
    private readonly IUserService _userService;

    public GetProfileHandler(IUserService userService)
    {
        _userService = userService;
    }

    public async Task<Profile> Handle(GetProfile request, CancellationToken cancellationToken)
    {
        var user = await _userService.GetAsync(request.Id);

        return new Profile(user);
    }
}