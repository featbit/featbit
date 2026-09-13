using System.Diagnostics;
using System.Text.Json;
using Dapper;
using Domain.Messages;
using Domain.Observability;
using Domain.Shared;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Infrastructure.MQ.Postgres;

public partial class PostgresMessageProducer(NpgsqlDataSource dataSource, ILogger<PostgresMessageProducer> logger)
    : IMessageProducer
{
    public async Task PublishAsync<TMessage>(string topic, TMessage? message) where TMessage : class
    {
        // M2: instrumented here, at the adapter, so every caller is covered and the provider is
        // known. The publish exception below is swallowed (unchanged behavior), which is exactly
        // why the failure must be counted — otherwise it is invisible.
        using var publish = MessagingMetrics.Current.BeginPublish(MessagingSystems.Postgres, topic);

        try
        {
            var jsonMessage = JsonSerializer.Serialize(message, ReusableJsonSerializerOptions.Web);
            _ = TraceContextPropagation.TryInject(Activity.Current, out var traceParent, out var traceState);

            await using var connection = await dataSource.OpenConnectionAsync();

            var messageId = await connection.ExecuteScalarAsync<long>(
                "insert into queue_messages (topic, payload, trace_parent, trace_state) values (@Topic, @Message, @TraceParent, @TraceState) returning id",
                new
                {
                    Topic = topic,
                    Message = jsonMessage,
                    TraceParent = traceParent.Length == 0 ? null : traceParent,
                    TraceState = traceParent.Length == 0 ? null : traceState
                }
            );

            publish.Enqueued();
            Log.MessagePublished(logger, topic, messageId, jsonMessage);
        }
        catch (Exception ex)
        {
            publish.Failed(ex);
            Log.ErrorPublishMessage(logger, ex);
        }
    }
}