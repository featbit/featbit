using Domain.DataSync;

namespace Application.DataSync;

public class UploadSyncData : IRequest<bool>
{
    public Guid EnvId { get; set; }

    public SyncData Data { get; set; }
}

public class UploadSyncDataHandler : IRequestHandler<UploadSyncData, bool>
{
    private readonly IDataSyncService _service;

    public UploadSyncDataHandler(IDataSyncService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(UploadSyncData request, CancellationToken cancellationToken)
    {
        await _service.SaveAsync(request.EnvId, request.Data);

        return true;
    }
}