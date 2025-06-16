using Domain.Shared;

namespace Streaming.Services;

public interface IRelayProxyService
{
    Task<SecretWithValue[]> GetSecretsAsync(string key);

    Task<Secret[]> GetServerSecretsAsync(string key);
}