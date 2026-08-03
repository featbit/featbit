using Infrastructure.Caches.Redis;
using MediatR;
using StackExchange.Redis;

namespace Api.Application.Admin;

public class GetConnections : IRequest<IReadOnlyList<ConnectionDto>>;

public record ConnectionDto(string Id, string EnvId, string Secret);

public class GetConnectionsHandler(IRedisClient redisClient, ILogger<GetConnectionsHandler> logger)
    : IRequestHandler<GetConnections, IReadOnlyList<ConnectionDto>>
{
    public async Task<IReadOnlyList<ConnectionDto>> Handle(GetConnections request, CancellationToken cancellationToken)
    {
        try
        {
            var server = redisClient.Connection.GetServers().FirstOrDefault(s => s.IsConnected);
            if (server is null)
            {
                logger.LogWarning("No connected Redis server found.");
                return [];
            }

            var keys = server.Keys(pattern: "featbit:connection:*").ToList();
            logger.LogInformation("Found {Count} connection key(s) in Redis.", keys.Count);

            var db = redisClient.GetDatabase();
            var connections = new List<ConnectionDto>(keys.Count);

            foreach (var key in keys)
            {
                var hash = await db.HashGetAllAsync(key);
                if (hash.Length == 0)
                    continue;

                var dict = hash.ToDictionary(h => h.Name.ToString(), h => h.Value.ToString());
                connections.Add(new ConnectionDto(
                    Id: dict.GetValueOrDefault("id", key.ToString()),
                    EnvId: dict.GetValueOrDefault("envId", ""),
                    Secret: dict.GetValueOrDefault("secret", "")
                ));
            }

            return connections;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error retrieving connections from Redis.");
            return [];
        }
    }
}
