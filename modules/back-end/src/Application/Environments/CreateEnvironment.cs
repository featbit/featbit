using Application.Bases;
using Environment = Domain.Environments.Environment;

namespace Application.Environments;

public class CreateEnvironment : IRequest<EnvironmentVm>
{
    public Guid ProjectId { get; set; }

    public string Name { get; set; }

    public string Description { get; set; }
}

public class CreateEnvironmentValidator : AbstractValidator<CreateEnvironment>
{
    public CreateEnvironmentValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.NameIsRequired);
    }
}

public class CreateEnvironmentHandler : IRequestHandler<CreateEnvironment, EnvironmentVm>
{
    private readonly IEnvironmentService _service;
    private readonly IMapper _mapper;

    public CreateEnvironmentHandler(IEnvironmentService service, IMapper mapper)
    {
        _service = service;
        _mapper = mapper;
    }

    public async Task<EnvironmentVm> Handle(CreateEnvironment request, CancellationToken cancellationToken)
    {
        var env = new Environment(request.ProjectId, request.Name, request.Description);

        await _service.AddAsync(env);

        return _mapper.Map<EnvironmentVm>(env);
    }
}