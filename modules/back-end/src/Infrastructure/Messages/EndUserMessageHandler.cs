using System.Text.Json;
using Domain.EndUsers;
using Domain.Messages;
using Domain.Utils;
using Infrastructure.Redis;
using StackExchange.Redis;

namespace Infrastructure.Messages;

public class EndUserMessageHandler : IMessageHandler
{
    public string Topic => Topics.EndUser;

    private readonly IEndUserService _service;
    private readonly IDatabase _redis;

    public EndUserMessageHandler(IEndUserService service, IRedisClient redisClient)
    {
        _service = service;
        _redis = redisClient.GetDatabase();
    }

    public async Task HandleAsync(string message, CancellationToken cancellationToken)
    {
        var endUserMessage =
            JsonSerializer.Deserialize<EndUserMessage>(message, ReusableJsonSerializerOptions.Web);

        // upsert endUser and it's properties
        var endUser = endUserMessage!.AsEndUser();
        await _service.UpsertAsync(endUser);
        await _service.AddNewPropertiesAsync(endUser);

        var key = RedisKeys.EndUser(endUser);
        await _redis.StringSetAsync(
            key: key,
            value: RedisValue.Null,
            expiry: TimeSpan.FromSeconds(30),
            when: When.NotExists
        );
    }
}