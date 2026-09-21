using Application.Bases.Exceptions;
using Domain.FeatureFlags;

namespace Application.FeatureFlags;

public class GetFeatureFlagById : IRequest<FeatureFlag>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }
}

public class GetFeatureFlagByIdHandler(IFeatureFlagService service)
    : IRequestHandler<GetFeatureFlagById, FeatureFlag>
{
    public async Task<FeatureFlag> Handle(GetFeatureFlagById request, CancellationToken cancellationToken)
    {
        var flag = await service.FindOneAsync(flag => flag.EnvId == request.EnvId && flag.Id == request.Id);
        if (flag is null)
        {
            throw new EntityNotFoundException(nameof(FeatureFlag), $"{request.Id}");
        }

        return flag;
    }
}
