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
    // IMessageProducer is Singleton, so we can use a field to store the last cleanup time
    private DateTime? _lastCleanupAt;

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

                // cleanup old notifications
                if (!_lastCleanupAt.HasValue || DateTime.UtcNow - _lastCleanupAt.Value > TimeSpan.FromDays(1))
                {
                    await CleanupNotificationsAsync(connection);
                }
            }

            Log.MessagePublished(logger, topic, messageId!, jsonMessage);
        }
        catch (Exception ex)
        {
            Log.ErrorPublishMessage(logger, ex);
        }

        return;

        async Task CleanupNotificationsAsync(NpgsqlConnection connection)
        {
            try
            {
                var deleted = await connection.ExecuteAsync(
                    $"""
                     delete
                     from queue_messages
                     where status = '{QueueMessageStatus.Notified}'
                       and enqueued_at < now() - interval '1 day';
                     """
                );

                Log.NotificationsCleaned(logger, deleted);
            }
            catch (Exception ex)
            {
                Log.ErrorCleanupNotifications(logger, ex);
            }

            _lastCleanupAt = DateTime.UtcNow;
        }
    }
}