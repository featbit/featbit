using Application.Bases;

namespace Application.Environments;

public class UpdateEnvironment : IRequest<EnvironmentVm>
{
    public Guid Id { get; set; }

    public string Name { get; set; }

    public string Description { get; set; }
}

public class UpdateEnvironmentValidator : AbstractValidator<UpdateEnvironment>
{
    public UpdateEnvironmentValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("name"));
    }
}

public class UpdateEnvironmentHandler : IRequestHandler<UpdateEnvironment, EnvironmentVm>
{
    private readonly IEnvironmentService _service;
    private readonly IMapper _mapper;

    public UpdateEnvironmentHandler(IEnvironmentService service, IMapper mapper)
    {
        _service = service;
        _mapper = mapper;
    }

    public async Task<EnvironmentVm> Handle(UpdateEnvironment request, CancellationToken cancellationToken)
    {
        var env = await _service.GetAsync(request.Id);

        env.Update(request.Name, request.Description);

        await _service.UpdateAsync(env);

        return _mapper.Map<EnvironmentVm>(env);
    }
}