using Application.Bases;

namespace Application.Environments;

public class UpdateEnvironment : IRequest<EnvironmentVm>
{
    /// <summary>
    /// The ID of the environment to update. Retrieved from the URL path.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// The new name for the environment.
    /// </summary>
    public string Name { get; set; }

    /// <summary>
    /// The new description for the environment.
    /// </summary>
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