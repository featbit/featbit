namespace Application.Environments;

public class DeleteSetting : IRequest<bool>
{
    public Guid EnvId { get; set; }

    public string Id { get; set; }
}

public class DeleteSettingHandler : IRequestHandler<DeleteSetting, bool>
{
    private readonly IEnvironmentService _service;

    public DeleteSettingHandler(IEnvironmentService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(DeleteSetting request, CancellationToken cancellationToken)
    {
        var environment = await _service.GetAsync(request.EnvId);
        environment.DeleteSetting(request.Id);

        await _service.UpdateAsync(environment);

        return true;
    }
}