namespace Application.Environments;

public class GetEnvironment : IRequest<EnvironmentVm>
{
    public Guid Id { get; set; }
}

public class GetEnvironmentHandler : IRequestHandler<GetEnvironment, EnvironmentVm>
{
    private readonly IEnvironmentService _service;
    private readonly IMapper _mapper;

    public GetEnvironmentHandler(IEnvironmentService service, IMapper mapper)
    {
        _service = service;
        _mapper = mapper;
    }

    public async Task<EnvironmentVm> Handle(GetEnvironment request, CancellationToken cancellationToken)
    {
        var env = await _service.GetAsync(request.Id);
        return _mapper.Map<EnvironmentVm>(env);
    }
}