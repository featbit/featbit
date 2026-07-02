using System.Text.Json;
using Dapper;
using Domain.Messages;
using Domain.Shared;
using Microsoft.Extensions.Logging;
using Npgsql;

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
}