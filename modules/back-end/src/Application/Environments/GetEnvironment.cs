using Domain.Policies;

namespace Application.Environments;

public class GetEnvironment : IRequest<EnvironmentVm>
{
    public Guid Id { get; set; }

    public PolicyStatement[] Permissions { get; set; } = [];
}

public class GetEnvironmentHandler(IEnvironmentService envService, IResourceService resourceService, IMapper mapper)
    : IRequestHandler<GetEnvironment, EnvironmentVm>
{
    public async Task<EnvironmentVm> Handle(GetEnvironment request, CancellationToken cancellationToken)
    {
        var env = await envService.GetAsync(request.Id);

        var resourceRn = await resourceService.GetEnvRnAsync(env.Id);
        env.Sanitize(resourceRn, request.Permissions);

        return mapper.Map<EnvironmentVm>(env);
    }
}
