using System.Text.Json;
using Dapper;
using Domain.Messages;
using Domain.Shared;
using Microsoft.Extensions.Logging;
using Npgsql;
using NpgsqlTypes;

namespace Infrastructure.MQ.Postgres;

public partial class PostgresMessageProducer(NpgsqlDataSource dataSource, ILogger<PostgresMessageProducer> logger)
    : IMessageProducer
{
    public async Task PublishAsync<TMessage>(string topic, TMessage? message) where TMessage : class
    {
        try
        {
            var jsonMessage = JsonSerializer.Serialize(message, ReusableJsonSerializerOptions.Web);

            await using var connection = await dataSource.OpenConnectionAsync();

            var messageId = await connection.ExecuteScalarAsync<long>(
                "insert into queue_messages (topic, payload) values (@Topic, @Message) returning id",
                new { Topic = topic, Message = jsonMessage }
            );

            Log.MessagePublished(logger, topic, messageId, jsonMessage);
        }
        catch (Exception ex)
        {
            Log.ErrorPublishMessage(logger, ex);
        }
    }

    public async Task PublishBatchAsync<TMessage>(string topic, IReadOnlyCollection<TMessage> messages)
        where TMessage : class
    {
        if (messages.Count == 0)
        {
            return;
        }

        try
        {
            await using var connection = await dataSource.OpenConnectionAsync();

            await using var writer = await connection.BeginBinaryImportAsync(
                "COPY queue_messages (topic, payload) FROM STDIN (FORMAT BINARY)"
            );

            foreach (var message in messages)
            {
                var json = JsonSerializer.Serialize(message, ReusableJsonSerializerOptions.Web);
                await writer.StartRowAsync();
                await writer.WriteAsync(topic, NpgsqlDbType.Varchar);
                await writer.WriteAsync(json, NpgsqlDbType.Text);
            }

            await writer.CompleteAsync();
            
            Log.MessageBatchPublished(logger, messages.Count, topic);
        }
        catch (Exception ex)
        {
            Log.ErrorPublishMessage(logger, ex);
        }
    }
}
