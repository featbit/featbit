using Application.Bases;
using Application.Bases.Exceptions;
using Domain.Environments;
using Environment = Domain.Environments.Environment;

namespace Application.Environments;

public class CreateEnvironment : IRequest<EnvironmentVm>
{
    /// <summary>
    /// The ID of the project the environment belongs to. Retrieved from the URL path.
    /// </summary>
    public Guid ProjectId { get; set; }

    /// <summary>
    /// The name of the environment.
    /// </summary>
    public string Name { get; set; }

    /// <summary>
    /// The unique key of the environment.
    /// </summary>
    public string Key { get; set; }

    /// <summary>
    /// The description of the environment.
    /// </summary>
    public string Description { get; set; }

    /// <summary>
    /// The settings of the environment. This is an optional field and can be used to set the initial settings for the environment.
    /// If not provided, the environment will be created with default settings.
    /// </summary>
    public EnvironmentSettings Settings { get; set; } = null;
}

public class CreateEnvironmentValidator : AbstractValidator<CreateEnvironment>
{
    public CreateEnvironmentValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("name"));

        RuleFor(x => x.Key)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("key"));
    }
}

public class CreateEnvironmentHandler(IEnvironmentService service, IMapper mapper, IPublisher publisher)
    : IRequestHandler<CreateEnvironment, EnvironmentVm>
{
    public async Task<EnvironmentVm> Handle(CreateEnvironment request, CancellationToken cancellationToken)
    {
        var keyHasBeenUsed = await service.HasKeyBeenUsedAsync(request.ProjectId, request.Key);
        if (keyHasBeenUsed)
        {
            throw new BusinessException(ErrorCodes.KeyHasBeenUsed);
        }

        var env = new Environment(request.ProjectId, request.Name, request.Key, request.Description, request.Settings);
        await service.AddWithBuiltInPropsAsync(env);

        // publish on environment added notification
        await publisher.Publish(new OnEnvironmentAdded(env), cancellationToken);

        return mapper.Map<EnvironmentVm>(env);
    }
}