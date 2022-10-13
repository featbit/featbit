using Domain.DataSync;

namespace Application.DataSync;

public class DownloadSyncData : IRequest<SyncData>
{
    public Guid EnvId { get; set; }
}

public class DownloadSyncDataHandler : IRequestHandler<DownloadSyncData, SyncData>
{
    private readonly IDataSyncService _service;

    public DownloadSyncDataHandler(IDataSyncService service)
    {
        _service = service;
    }

    public async Task<SyncData> Handle(DownloadSyncData request, CancellationToken cancellationToken)
    {
        return await _service.GetSyncDataAsync(request.EnvId);
    }
}