using Application.Users;

namespace Application.FeatureFlags;

public class ArchiveFeatureFlag : IRequest<bool>
{
    public Guid Id { get; set; }
}

public class ArchiveFeatureFlagHandler : IRequestHandler<ArchiveFeatureFlag, bool>
{
    private readonly IFeatureFlagService _service;
    private readonly ICurrentUser _currentUser;

    public ArchiveFeatureFlagHandler(IFeatureFlagService service, ICurrentUser currentUser)
    {
        _service = service;
        _currentUser = currentUser;
    }
    
    public async Task<bool> Handle(ArchiveFeatureFlag request, CancellationToken cancellationToken)
    {
        var flag = await _service.GetAsync(request.Id);

        flag.Archive(_currentUser.Id);

        await _service.UpdateAsync(flag);

        return true;
    }
}