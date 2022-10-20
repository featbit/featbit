using Application.Users;

namespace Application.FeatureFlags;

public class RestoreFeatureFlag : IRequest<bool>
{
    public Guid Id { get; set; }
}

public class UnArchiveFeatureFlagHandler : IRequestHandler<RestoreFeatureFlag, bool>
{
    private readonly IFeatureFlagService _service;
    private readonly ICurrentUser _currentUser;

    public UnArchiveFeatureFlagHandler(IFeatureFlagService service, ICurrentUser currentUser)
    {
        _service = service;
        _currentUser = currentUser;
    }

    public async Task<bool> Handle(RestoreFeatureFlag request, CancellationToken cancellationToken)
    {
        var flag = await _service.GetAsync(request.Id);
        flag.UnArchive(_currentUser.Id);

        await _service.UpdateAsync(flag);

        return true;
    }
}