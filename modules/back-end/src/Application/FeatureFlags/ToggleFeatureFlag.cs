using Application.Users;

namespace Application.FeatureFlags;

public class ToggleFeatureFlag : IRequest<bool>
{
    public Guid Id { get; set; }
}

public class ToggleFeatureFlagHandler : IRequestHandler<ToggleFeatureFlag, bool>
{
    private readonly IFeatureFlagService _service;
    private readonly ICurrentUser _currentUser;

    public ToggleFeatureFlagHandler(IFeatureFlagService service, ICurrentUser currentUser)
    {
        _service = service;
        _currentUser = currentUser;
    }

    public async Task<bool> Handle(ToggleFeatureFlag request, CancellationToken cancellationToken)
    {
        var flag = await _service.GetAsync(request.Id);

        flag.Toggle(_currentUser.Id);

        await _service.UpdateAsync(flag);

        return true;
    }
}