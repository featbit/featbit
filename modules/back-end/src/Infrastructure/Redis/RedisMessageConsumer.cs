using System.Text.Json;
using Domain.EndUsers;
using Domain.Messages;
using Domain.Utils;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace Infrastructure.Redis;

public partial class RedisMessageConsumer : BackgroundService
{
    private readonly IConnectionMultiplexer _redis;
    private readonly IEndUserService _service;
    private readonly ILogger<RedisMessageConsumer> _logger;

    public RedisMessageConsumer(
        IConnectionMultiplexer redis,
        IEndUserService service,
        ILogger<RedisMessageConsumer> logger)
    {
        _redis = redis;
        _service = service;
        _logger = logger;
    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        return Task.Factory.StartNew(
            async () => { await StartConsumerLoop(stoppingToken); },
            TaskCreationOptions.LongRunning
        );
    }

    private async Task StartConsumerLoop(CancellationToken cancellationToken)
    {
        var db = _redis.GetDatabase();
        var message = string.Empty;

        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                var messages = await db.ListLeftPopAsync(Topics.EndUser, 100);
                if (messages.Length == 0)
                {
                    // If there is no message, delay consumer by 1 second
                    await Task.Delay(1000, cancellationToken);
                    return;
                }

                for (var i = 0; i < messages.Length; i++)
                {
                    message = messages[i].ToString();

                    var endUserMessage =
                        JsonSerializer.Deserialize<EndUserMessage>(message, ReusableJsonSerializerOptions.Web);
                    if (endUserMessage == null)
                    {
                        continue;
                    }

                    // upsert endUser and it's properties
                    var endUser = endUserMessage.AsEndUser();
                    await _service.UpsertAsync(endUser);
                    await _service.AddNewPropertiesAsync(endUser);
                }
            }
            catch (OperationCanceledException)
            {
                // ignore
            }
            catch (Exception ex)
            {
                Log.ErrorConsumeMessage(_logger, message, ex);
            }
        }
    }
}