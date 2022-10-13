using Domain.Environments;

namespace Application.Environments;

public class GetSettings : IRequest<IEnumerable<Setting>>
{
    public Guid EnvId { get; set; }

    public string Type { get; set; }
}

public class GetSettingsHandler : IRequestHandler<GetSettings, IEnumerable<Setting>>
{
    private readonly IEnvironmentService _service;

    public GetSettingsHandler(IEnvironmentService service)
    {
        _service = service;
    }

    public async Task<IEnumerable<Setting>> Handle(GetSettings request, CancellationToken cancellationToken)
    {
        return await _service.GetSettingsAsync(request.EnvId, request.Type);
    }
}