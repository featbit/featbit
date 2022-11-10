using Application.Users;

namespace Application.FeatureFlags;

public class SetTags : IRequest<bool>
{
    public Guid Id { get; set; }

    public ICollection<string> Tags { get; set; }
}

public class SetTagsHandler : IRequestHandler<SetTags, bool>
{
    private readonly IFeatureFlagService _service;
    private readonly ICurrentUser _currentUser;

    public SetTagsHandler(IFeatureFlagService service, ICurrentUser currentUser)
    {
        _service = service;
        _currentUser = currentUser;
    }

    public async Task<bool> Handle(SetTags request, CancellationToken cancellationToken)
    {
        var flag = await _service.GetAsync(request.Id);
        flag.SetTags(request.Tags, _currentUser.Id);

        await _service.UpdateAsync(flag);
        return true;
    }
}