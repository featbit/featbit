using System.Net.Mime;
using System.Text;
using System.Text.Json;
using Application.Bases.Exceptions;
using Domain.DataSync;
using Domain.Environments;
using Domain.Utils;
using Microsoft.Extensions.Logging;

namespace Application.DataSync;

public class SyncToRemote : IRequest<string>
{
    public Guid WorkspaceId { get; set; }

    public Guid EnvId { get; set; }

    public string SettingId { get; set; }
}

public class SyncToRemoteHandler : IRequestHandler<SyncToRemote, string>
{
    private readonly IEnvironmentService _envService;
    private readonly IEnvironmentAppService _envAppService;
    private readonly IFeatureFlagService _flagService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<SyncToRemoteHandler> _logger;

    public SyncToRemoteHandler(
        IEnvironmentService envService,
        IEnvironmentAppService envAppService,
        IFeatureFlagService flagService,
        IHttpClientFactory httpClientFactory,
        ILogger<SyncToRemoteHandler> logger)
    {
        _envService = envService;
        _envAppService = envAppService;
        _flagService = flagService;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<string> Handle(SyncToRemote request, CancellationToken cancellationToken)
    {
        // get url setting
        var env = await _envService.GetAsync(request.EnvId);
        var setting = env.Settings.FirstOrDefault(x => x.Id == request.SettingId);
        if (setting == null)
        {
            throw new EntityNotFoundException(nameof(Setting), $"{request.EnvId}-{request.SettingId}");
        }

        // sync to remote url
        var remoteUrl = setting.Value;

        var client = _httpClientFactory.CreateClient();
        var payload = await GetSyncPayloadAsync(request.WorkspaceId, request.EnvId);
        var content = new StringContent(
            JsonSerializer.Serialize(payload, ReusableJsonSerializerOptions.Web),
            Encoding.UTF8,
            MediaTypeNames.Application.Json
        );

        string remark;
        try
        {
            var response = await client.PostAsync(remoteUrl, content, cancellationToken);

            var result = response.IsSuccessStatusCode ? "true" : "false";
            remark = $"{result},{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(
                ex,
                "sync data to envId {EnvId}, remoteUrl {RemoteUrl} failed",
                request.EnvId, remoteUrl
            );

            remark = $"false,{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        }

        // write remark
        setting.WriteRemark(remark);
        await _envService.UpdateAsync(env);

        return remark;
    }

    private async Task<RemoteSyncPayload> GetSyncPayloadAsync(Guid workspaceId, Guid envId)
    {
        // feature flags
        var flags = await _flagService.FindManyAsync(x => x.EnvId == envId && !x.IsArchived);

        // segments
        var segments = await _envAppService.GetSegmentsAsync(workspaceId, envId);

        var payload = new RemoteSyncPayload
        {
            FeatureFlags = flags,
            Segments = segments
        };

        return payload;
    }
}