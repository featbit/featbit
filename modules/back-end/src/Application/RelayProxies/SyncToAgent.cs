using Application.Bases.Exceptions;
using Domain.Segments;

namespace Application.RelayProxies;

public class SyncToAgent : RpAgentBase, IRequest<SyncResult>
{
    public Guid WorkspaceId { get; set; }

    public Guid RelayProxyId { get; set; }

    public string AgentId { get; set; }
}

public class SyncToAgentValidator : AbstractValidator<SyncToAgent>
{
    public SyncToAgentValidator()
    {
        Include(new RpAgentBaseValidator());
    }
}

public class SyncToAgentHandler(
    IRelayProxyService relayProxyService,
    IProjectService projectService,
    IEnvironmentService envService,
    IEnvironmentAppService envAppService,
    IFeatureFlagService featureFlagService,
    IAgentService agentService)
    : IRequestHandler<SyncToAgent, SyncResult>
{
    public async Task<SyncResult> Handle(SyncToAgent request, CancellationToken cancellationToken)
    {
        var relayProxy = await relayProxyService.GetAsync(request.RelayProxyId);

        var agent = relayProxy.Agents.FirstOrDefault(agent => agent.Id == request.AgentId);
        if (agent == null)
        {
            throw new BusinessException("Inconsistent relay proxy data");
        }

        var envIds = relayProxy.IsAllEnvs
            ? await GetAllEnvIdsAsync(relayProxy.OrganizationId)
            : relayProxy.Scopes.Select(Guid.Parse).ToArray();

        if (envIds.Length == 0)
        {
            return SyncResult.Ok();
        }

        try
        {
            var syncResult = await PerformSyncAsync();
            agent.Synced(syncResult.Serves, syncResult.DataVersion);

            await relayProxyService.UpdateAsync(relayProxy);

            return syncResult;
        }
        catch (Exception ex)
        {
            return SyncResult.Fail(ex.Message);
        }

        async Task<Guid[]> GetAllEnvIdsAsync(Guid organizationId)
        {
            var projectWithEnvs = await projectService.GetListAsync(organizationId);
            return projectWithEnvs.SelectMany(p => p.Environments).Select(env => env.Id).ToArray();
        }

        async Task<SyncResult> PerformSyncAsync()
        {
            var secrets = await envService.GetRpSecretsAsync(envIds);
            var flags = await featureFlagService.FindManyAsync(flag => envIds.Contains(flag.EnvId));

            var segments = new Dictionary<Guid, ICollection<Segment>>();
            foreach (var envId in envIds)
            {
                var envSegments = await envAppService.GetSegmentsAsync(request.WorkspaceId, envId);
                segments[envId] = envSegments;
            }

            var payload = new
            {
                eventType = "rp_full",
                items = envIds.Select(envId => new
                {
                    envId,
                    secrets = secrets.Where(secret => secret.EnvId == envId),
                    featureFlags = flags.Where(flag => flag.EnvId == envId),
                    segments = segments[envId]
                })
            };

            return await agentService.BootstrapAsync(request.Host, relayProxy.Key, payload);
        }
    }
}