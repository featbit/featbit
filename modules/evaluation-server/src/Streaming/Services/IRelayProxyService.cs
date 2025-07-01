using Domain.Shared;

namespace Streaming.Services;

public interface IRelayProxyService
{
    Task<bool> IsKeyValidAsync(string key);

    Task<SecretWithValue[]> GetSecretsAsync(string key);

    Task<Secret[]> GetServerSecretsAsync(string key);

    Task RegisterAgentAsync(string key, string agentId);

    Task UpdateAgentStatusAsync(string key, string agentId, string status);
}