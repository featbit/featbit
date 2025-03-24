using System.Text.Json;
using Dapper;
using Domain.Messages;
using Domain.Utils;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Infrastructure.MQ.Postgres;

public partial class PostgresMessageProducer(NpgsqlDataSource dataSource, ILogger<PostgresMessageProducer> logger)
    : IMessageProducer
{
    public async Task PublishAsync<TMessage>(string topic, TMessage message) where TMessage : class
    {
        var isNotificationTopic = topic is Topics.FeatureFlagChange or Topics.SegmentChange;

        try
        {
            var jsonMessage = JsonSerializer.Serialize(message, ReusableJsonSerializerOptions.Web);

            await using var connection = await dataSource.OpenConnectionAsync();

            var messageId = await connection.ExecuteScalarAsync<string>(
                "insert into queue_messages (topic, status, payload) values (@Topic, @Status, @Message) returning id",
                new
                {
                    Topic = topic,
                    Status = isNotificationTopic
                        ? QueueMessageStatus.Notified
                        : QueueMessageStatus.Pending,
                    Message = jsonMessage
                }
            );

            // for notification topics, we need to notify the subscribers
            if (isNotificationTopic)
            {
                var channel = Topics.ToChannel(topic);

                await connection.ExecuteAsync(
                    "select pg_notify(@Channel, @MessageId)",
                    new { Channel = channel, MessageId = messageId }
                );
            }

            Log.MessagePublished(logger, topic, messageId!, jsonMessage);
        }
        catch (Exception ex)
        {
            Log.ErrorPublishMessage(logger, ex);
        }
    }
}