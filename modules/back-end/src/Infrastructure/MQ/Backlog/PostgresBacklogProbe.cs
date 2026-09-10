using Dapper;
using Domain.Messages;
using Domain.Observability;
using Npgsql;

namespace Infrastructure.MQ.Backlog;

/// <summary>
/// Counts pending rows in <c>queue_messages</c>, grouped by topic.
/// </summary>
/// <remarks>
/// <para>
/// This is the most expensive of the three probes and the one most likely to misbehave under
/// exactly the conditions it is meant to report on. The table's index is
/// <c>(not_visible_until, topic, status)</c>, which does not lead with <c>topic</c>, so a grouped
/// count over a large backlog can degrade into a scan — and a large backlog is precisely when an
/// operator is looking at this number.
/// </para>
/// <para>
/// Two bounds make that safe. A server-side <c>statement_timeout</c> caps the work Postgres will do
/// regardless of what the client does, and a client-side command timeout caps the wait. On timeout
/// the query throws, the sampler catches it, and the depth is reported as unknown — a diagnostic
/// that degrades to "I don't know" rather than adding load to a database already in trouble.
/// </para>
/// <para>
/// Only <c>Pending</c> rows are counted. <c>Processing</c> rows have been claimed by a consumer and
/// are not waiting; <c>Failed</c> rows are terminal until the retry follow-up is built, so counting
/// them would make the backlog appear to grow forever after a single poison message.
/// </para>
/// </remarks>
public sealed class PostgresBacklogProbe(NpgsqlDataSource dataSource, string[] topics) : IBacklogProbe
{
    /// <summary>
    /// Server-side cap on the count query. Deliberately well under the default sampling interval,
    /// so a slow cycle can never overlap the next one.
    /// </summary>
    public const int StatementTimeoutMs = 3_000;

    // Only string constants can be interpolated into a const string, so the timeout is spelled
    // once as text and asserted against StatementTimeoutMs by test.
    private const string StatementTimeoutLiteral = "3000";

    internal const string CountSql =
        $"""
         set local statement_timeout = {StatementTimeoutLiteral};

         select topic, count(*) as depth
         from queue_messages
         where status = '{QueueMessageStatus.Pending}'
             and topic = any(@Topics)
         group by topic
         """;

    public string Provider => MessagingSystems.Postgres;

    public IReadOnlyList<string> Topics { get; } = topics;

    public async Task<IReadOnlyDictionary<string, long>> SampleAsync(CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);

        // statement_timeout is SET LOCAL, so it needs a transaction to be local to; without one it
        // would either error or leak to the whole session.
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        var rows = await connection.QueryAsync<(string topic, long depth)>(
            new CommandDefinition(
                CountSql,
                new { Topics = topics },
                transaction,
                commandTimeout: (StatementTimeoutMs / 1000) + 2,
                cancellationToken: cancellationToken));

        await transaction.CommitAsync(cancellationToken);

        // Topics with no pending rows are absent from a grouped count, and for this query that
        // genuinely means zero rather than unknown — the query succeeded and found none.
        var depths = new Dictionary<string, long>(Topics.Count, StringComparer.Ordinal);
        foreach (var topic in Topics)
        {
            depths[topic] = 0;
        }

        foreach (var (topic, depth) in rows)
        {
            depths[topic] = depth;
        }

        return depths;
    }
}
