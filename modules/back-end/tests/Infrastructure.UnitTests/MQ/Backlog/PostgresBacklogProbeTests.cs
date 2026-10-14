using Domain.Messages;
using Infrastructure.MQ.Backlog;
using Infrastructure.MQ.Postgres;

namespace Infrastructure.UnitTests.MQ.Backlog;

/// <summary>
/// Structural tests for the Postgres backlog query.
/// </summary>
/// <remarks>
/// This probe cannot be exercised without a database, so what is pinned here is the part that would
/// otherwise rot silently: the statement timeout the query actually sends, and the status it counts.
/// Both are load-bearing. Without the timeout, the most expensive query in the observability work
/// runs unbounded against a database that is — by the definition of a large backlog — already
/// struggling. And counting the wrong status would make the backlog appear to grow forever after a
/// single poison message.
/// </remarks>
public class PostgresBacklogProbeTests
{
    [Fact]
    public void CountSql_SendsTheStatementTimeoutItDocuments()
    {
        // Assert
        // The literal and the constant are separate because only string constants can be
        // interpolated into a const string — so they need an assertion to stay in step.
        Assert.Contains(
            $"set local statement_timeout = {PostgresBacklogProbe.StatementTimeoutMs};",
            PostgresBacklogProbe.CountSql,
            StringComparison.Ordinal);
    }

    [Fact]
    public void CountSql_CountsOnlyPendingRows()
    {
        // Assert
        Assert.Contains(
            $"status = '{QueueMessageStatus.Pending}'",
            PostgresBacklogProbe.CountSql,
            StringComparison.Ordinal);

        // Processing rows have been claimed and are not waiting; Failed rows are terminal.
        Assert.DoesNotContain(QueueMessageStatus.Processing, PostgresBacklogProbe.CountSql, StringComparison.Ordinal);
        Assert.DoesNotContain(QueueMessageStatus.Failed, PostgresBacklogProbe.CountSql, StringComparison.Ordinal);
    }

    [Fact]
    public void CountSql_FiltersByTopicWithAParameter()
    {
        // Assert
        // Topic names are FeatBit constants, but a parameter is still what keeps this query from
        // becoming a string-concatenation habit that someone later applies to a value that is not.
        Assert.Contains("topic = any(@Topics)", PostgresBacklogProbe.CountSql, StringComparison.Ordinal);
    }

    [Fact]
    public void StatementTimeout_IsWellUnderTheDefaultSampleInterval()
    {
        // Assert
        // A cycle that outran its interval would overlap the next one and compound the load.
        Assert.True(
            PostgresBacklogProbe.StatementTimeoutMs <
            MessagingBacklogSampler.DefaultInterval.TotalMilliseconds / 2);
    }

    [Fact]
    public void ConsumerTopics_MatchTheTopicsTheConsumerDrains()
    {
        // Assert
        // The probe is registered against PostgresConsumerTopics.All, the same array the consumer
        // is constructed with. A gauge watching a different set would report a drained queue for a
        // topic nobody is draining.
        Assert.Equal(
            [Topics.EndUser, Topics.Insights, Topics.Usage, ControlPlaneTopics.ControlPlaneWebHooks],
            PostgresConsumerTopics.All);
    }
}
