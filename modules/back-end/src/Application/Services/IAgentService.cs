using Domain.RelayProxies;

namespace Application.Services;

public interface IAgentService
{
    Task<AgentStatus> GetStatusAsync(string host, string key);
    
    Task SyncAsync(string host, string key, object payload);
}