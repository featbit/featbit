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
    private readonly IEndUserService _endUserService;
    private readonly IMapper _mapper;

    public CreateEnvironmentHandler(IEnvironmentService service, IMapper mapper, IEndUserService endUserService)
    {
        _service = service;
        _mapper = mapper;
        _endUserService = endUserService;
    }

    public async Task<EnvironmentVm> Handle(CreateEnvironment request, CancellationToken cancellationToken)
    {
        var keyHasBeenUsed = await _service.HasKeyBeenUsedAsync(request.ProjectId, request.Key);
        if (keyHasBeenUsed)
        {
            throw new BusinessException(ErrorCodes.KeyHasBeenUsed);
        }

        var env = new Environment(request.ProjectId, request.Name, request.Key, request.Description);
        await _service.AddOneAsync(env);

        // add env built-in end-user properties
        await _endUserService.AddBuiltInPropertiesAsync(env.Id);

        return _mapper.Map<EnvironmentVm>(env);
    }
}