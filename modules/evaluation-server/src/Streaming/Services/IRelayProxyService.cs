using Domain.Shared;

namespace Streaming.Services;

public interface IRelayProxyService
{
    Task<Secret[]> GetServerSecretsAsync(string key);

    Task<SecretSlim[]> GetSecretSlimsAsync(string key);
}