using Application.Bases;
using Application.Bases.Exceptions;
using Environment = Domain.Environments.Environment;

namespace Application.Environments;

public class CreateEnvironment : IRequest<EnvironmentVm>
{
    public Guid ProjectId { get; set; }

    public string Name { get; set; }

    public string Key { get; set; }

    public string Description { get; set; }
}

public class CreateEnvironmentValidator : AbstractValidator<CreateEnvironment>
{
    public CreateEnvironmentValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.NameIsRequired);

        RuleFor(x => x.Key)
            .NotEmpty().WithErrorCode(ErrorCodes.KeyIsRequired);
    }
}

public class CreateEnvironmentHandler : IRequestHandler<CreateEnvironment, EnvironmentVm>
{
    private readonly IEnvironmentService _service;
    private readonly IMapper _mapper;
    private readonly IPublisher _publisher;

    public CreateEnvironmentHandler(IEnvironmentService service, IMapper mapper, IPublisher publisher)
    {
        _service = service;
        _mapper = mapper;
        _publisher = publisher;
    }

    public async Task<EnvironmentVm> Handle(CreateEnvironment request, CancellationToken cancellationToken)
    {
        var keyHasBeenUsed = await _service.HasKeyBeenUsedAsync(request.ProjectId, request.Key);
        if (keyHasBeenUsed)
        {
            throw new BusinessException(ErrorCodes.KeyHasBeenUsed);
        }

        var env = new Environment(request.ProjectId, request.Name, request.Key, request.Description);
        await _service.AddWithBuiltInPropsAsync(env);

        // publish on environment added notification
        await _publisher.Publish(new OnEnvironmentAdded(env), cancellationToken);

        return _mapper.Map<EnvironmentVm>(env);
    }
}