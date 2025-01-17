﻿using Application.Bases.Exceptions;
using Domain.Segments;

namespace Application.RelayProxies;

public class SyncToAgent : IRequest<SyncResult>
{
    public Guid WorkspaceId { get; set; }

    public Guid RelayProxyId { get; set; }

    public string AgentId { get; set; }
}

public class SyncToAgentHandler : IRequestHandler<SyncToAgent, SyncResult>
{
    private readonly IRelayProxyService _relayProxyService;
    private readonly IProjectService _projectService;
    private readonly IEnvironmentAppService _envAppService;
    private readonly IFeatureFlagService _featureFlagService;
    private readonly IAgentService _agentService;

    public SyncToAgentHandler(
        IRelayProxyService relayProxyService,
        IProjectService projectService,
        IEnvironmentAppService envAppService,
        IFeatureFlagService featureFlagService,
        IAgentService agentService)
    {
        _relayProxyService = relayProxyService;
        _projectService = projectService;
        _envAppService = envAppService;
        _featureFlagService = featureFlagService;
        _agentService = agentService;
    }

    public async Task<SyncResult> Handle(SyncToAgent request, CancellationToken cancellationToken)
    {
        var relayProxy = await _relayProxyService.GetAsync(request.RelayProxyId);

        var agent = relayProxy.Agents.FirstOrDefault(agent => agent.Id == request.AgentId);
        if (agent == null)
        {
            throw new BusinessException("Inconsistent relay proxy data");
        }

        var envIds = relayProxy.IsAllEnvs
            ? await GetAllEnvIdsAsync(relayProxy.OrganizationId)
            : relayProxy.Scopes.SelectMany(scope => scope.EnvIds).Distinct().ToArray();

        if (!envIds.Any())
        {
            return SyncResult.Ok(agent.SyncAt);
        }

        try
        {
            await PerformSyncAsync();

            relayProxy.AgentSynced(agent);
            await _relayProxyService.UpdateAsync(relayProxy);

            return SyncResult.Ok(agent.SyncAt);
        }
        catch (Exception ex)
        {
            return SyncResult.Failed(ex.Message);
        }

        async Task<Guid[]> GetAllEnvIdsAsync(Guid organizationId)
        {
            var projectWithEnvs = await _projectService.GetListAsync(organizationId);
            return projectWithEnvs.SelectMany(p => p.Environments).Select(env => env.Id).ToArray();
        }

        async Task PerformSyncAsync()
        {
            var flags = await _featureFlagService.FindManyAsync(flag => envIds.Contains(flag.EnvId));

            var segments = new Dictionary<Guid, ICollection<Segment>>();
            foreach (var envId in envIds)
            {
                var envSegments = await _envAppService.GetSegmentsAsync(request.WorkspaceId, envId);
                segments[envId] = envSegments;
            }

            var payload = envIds.Select(envId => new
            {
                EnvId = envId,
                Flags = flags.Where(flag => flag.EnvId == envId),
                Segments = segments[envId]
            });

            await _agentService.BootstrapAsync(agent.Host, relayProxy.Key, payload);
        }
    }
}