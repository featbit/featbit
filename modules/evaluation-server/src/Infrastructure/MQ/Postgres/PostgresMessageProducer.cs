using System.Diagnostics;
using System.Text.Json;
using Dapper;
using Domain.Messages;
using Domain.Observability;
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

    public async Task PublishBatchAsync<TMessage>(string topic, IReadOnlyCollection<TMessage> messages)
        where TMessage : class
    {
        if (messages.Count == 0)
        {
            return;
        }

        // M2: same reasoning as the single-message path — the exception below is swallowed, so the
        // counter is the only trace a failure leaves. The batch size goes to the scope so that
        // published stays a message count.
        using var publish = MessagingMetrics.Current.BeginPublish(
            MessagingSystems.Postgres, topic, messages.Count);

        try
        {
            // The COPY has to carry the trace columns as well as the payload. Writing only
            // (topic, payload) would leave trace_parent null for every batched message, and the
            // consumer would start a new trace instead of continuing this one.
            var hasTraceContext =
                TraceContextPropagation.TryInject(Activity.Current, out var traceParent, out var traceState);

            await using var connection = await dataSource.OpenConnectionAsync();

            await using var writer = await connection.BeginBinaryImportAsync(
                "COPY queue_messages (topic, payload, trace_parent, trace_state) FROM STDIN (FORMAT BINARY)"
            );

            foreach (var message in messages)
            {
                var json = JsonSerializer.Serialize(message, ReusableJsonSerializerOptions.Web);
                await writer.StartRowAsync();
                await writer.WriteAsync(topic, NpgsqlDbType.Varchar);
                await writer.WriteAsync(json, NpgsqlDbType.Text);

                // Binary COPY is positional: every column named above must be written for every
                // row, so an absent trace context is an explicit null rather than a skipped write.
                if (hasTraceContext)
                {
                    await writer.WriteAsync(traceParent, NpgsqlDbType.Text);
                }
                else
                {
                    await writer.WriteNullAsync();
                }

                if (hasTraceContext && !string.IsNullOrEmpty(traceState))
                {
                    await writer.WriteAsync(traceState, NpgsqlDbType.Text);
                }
                else
                {
                    await writer.WriteNullAsync();
                }
            }

            await writer.CompleteAsync();

            publish.Enqueued();
            Log.MessageBatchPublished(logger, messages.Count, topic);
        }
        catch (Exception ex)
        {
            publish.Failed(ex);
            Log.ErrorPublishMessage(logger, ex);
        }
    }
}
