using Domain.Shared;

namespace Streaming.Services;

public interface IRelayProxyService
{
    Task<Secret[]> GetSecretsAsync(string key);
}