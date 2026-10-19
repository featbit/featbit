using Domain.Policies;
using Application.Bases;
using Domain.Environments;

namespace Application.Environments;

public class UpdateEnvironmentPayload
{
    /// <summary>
    /// The new name for the environment.
    /// </summary>
    public string Name { get; set; }

    /// <summary>
    /// The new description for the environment.
    /// </summary>
    public string Description { get; set; }

    /// <summary>
    /// The new settings for the environment. This is an optional field and if not provided,
    /// the environment settings will remain unchanged.
    /// </summary>
    public EnvironmentSettings Settings { get; set; } = null;
}

public class UpdateEnvironment : UpdateEnvironmentPayload, IRequest<EnvironmentVm>
{
    /// <summary>
    /// The ID of the environment to update. Retrieved from the URL path.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Current request permissions
    /// </summary>
    public PolicyStatement[] Permissions { get; set; } = [];

    public UpdateEnvironment(Guid id, UpdateEnvironmentPayload payload, PolicyStatement[] permissions)
    {
        Id = id;
        Name = payload.Name;
        Description = payload.Description;
        Settings = payload.Settings;
        Permissions = permissions;
    }
}

public class UpdateEnvironmentValidator : AbstractValidator<UpdateEnvironment>
{
    public UpdateEnvironmentValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("name"));
    }
}

public class UpdateEnvironmentHandler(IEnvironmentService service, IMapper mapper, IResourceService resources)
    : IRequestHandler<UpdateEnvironment, EnvironmentVm>
{
    public async Task<EnvironmentVm> Handle(UpdateEnvironment request, CancellationToken cancellationToken)
    {
        var env = await service.GetAsync(request.Id);
        env.Update(request.Name, request.Description, request.Settings);
        await service.UpdateAsync(env);

        var rn = await resources.GetEnvRnAsync(env.Id);
        env.Sanitize(rn, request.Permissions);

        return mapper.Map<EnvironmentVm>(env);
    }
}
