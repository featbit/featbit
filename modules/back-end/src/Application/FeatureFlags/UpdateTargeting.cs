using Application.Users;
using Domain.FeatureFlags;
using Domain.Targeting;

namespace Application.FeatureFlags;

public class UpdateTargeting : IRequest<bool>
{
    public Guid Id { get; set; }

    public ICollection<TargetUser> TargetUsers { get; set; }

    public ICollection<TargetRule> Rules { get; set; }

    public Fallthrough Fallthrough { get; set; }

    public bool ExptIncludeAllTargets { get; set; }
}

public class UpdateTargetingHandler : IRequestHandler<UpdateTargeting, bool>
{
    private readonly IFeatureFlagService _service;
    private readonly ICurrentUser _currentUser;

    public UpdateTargetingHandler(IFeatureFlagService service, ICurrentUser currentUser)
    {
        _service = service;
        _currentUser = currentUser;
    }

    public async Task<bool> Handle(UpdateTargeting request, CancellationToken cancellationToken)
    {
        var flag = await _service.GetAsync(request.Id);
        flag.UpdateTargeting(
            request.TargetUsers,
            request.Rules,
            request.Fallthrough,
            request.ExptIncludeAllTargets,
            _currentUser.Id
        );

        await _service.UpdateAsync(flag);

        return true;
    }
}