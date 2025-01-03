using Domain.DataSync;

namespace Application.DataSync;

public class DownloadSyncData : IRequest<SyncData>
{
    public Guid EnvId { get; set; }
}

public class DownloadSyncDataHandler : IRequestHandler<DownloadSyncData, SyncData>
{
    private readonly IEndUserService _service;

    public DownloadSyncDataHandler(IEndUserService service)
    {
        _service = service;
    }

    public async Task<SyncData> Handle(DownloadSyncData request, CancellationToken cancellationToken)
    {
        var envId = request.EnvId;

        var users = await _service.FindManyAsync(x => x.EnvId == envId);
        var properties = await _service.GetPropertiesAsync(envId);

        var data = new SyncData
        {
            Date = DateTime.UtcNow,
            Users = users.Select(x => new EndUserSyncData
            {
                KeyId = x.KeyId,
                Name = x.Name,
                CustomizedProperties = x.CustomizedProperties
            }),
            UserProperties = properties.Select(x => x.Name)
        };

        return data;
    }
}