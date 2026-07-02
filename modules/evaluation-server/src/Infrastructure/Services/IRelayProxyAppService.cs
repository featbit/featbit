using Domain.Workspaces;

namespace Infrastructure.Services;

public interface IRelayProxyAppService
{
    Task<Workspace?> GetWorkspaceAsync(string key);

    Task<bool> CheckQuotaAsync(Workspace workspace);

    Task RegisterAgentAsync(string key, string agentId);
}