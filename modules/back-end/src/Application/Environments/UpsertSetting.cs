using Domain.Environments;

namespace Application.Environments;

public class UpsertSetting : IRequest<bool>
{
    public Guid EnvId { get; set; }

    public IEnumerable<Setting> Settings { get; set; } = Array.Empty<Setting>();
}

public class UpsertSettingHandler : IRequestHandler<UpsertSetting, bool>
{
    private readonly IEnvironmentService _service;

    public UpsertSettingHandler(IEnvironmentService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(UpsertSetting request, CancellationToken cancellationToken)
    {
        var environment = await _service.GetAsync(request.EnvId);
        environment.UpsertSettings(request.Settings);

        await _service.UpdateAsync(environment);

        return true;
    }
}