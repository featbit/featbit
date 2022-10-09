using Application.Bases;
using Application.Bases.Exceptions;

namespace Application.FeatureFlags;

public class DeleteFeatureFlag : IRequest<bool>
{
    public Guid Id { get; set; }
}

public class DeleteFeatureFlagHandler : IRequestHandler<DeleteFeatureFlag, bool>
{
    private readonly IFeatureFlagService _service;

    public DeleteFeatureFlagHandler(IFeatureFlagService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(DeleteFeatureFlag request, CancellationToken cancellationToken)
    {
        var flag = await _service.GetAsync(request.Id);
        if (!flag.IsArchived)
        {
            throw new BusinessException(ErrorCodes.CannotDeleteUnArchivedFeatureFlag);
        }

        await _service.DeleteAsync(request.Id);

        return true;
    }
}