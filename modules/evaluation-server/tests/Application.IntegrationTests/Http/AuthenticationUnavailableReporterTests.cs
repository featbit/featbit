using Api.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Testing;

namespace Application.IntegrationTests.Http;

public class AuthenticationUnavailableReporterTests
{
    [Fact]
    public void Report_LogsImmediatelyAndResumesAtFiveSeconds()
    {
        var clock = new TestTimeProvider();
        var logger = new FakeLogger<AuthenticationUnavailableReporter>();
        var reporter = new AuthenticationUnavailableReporter(logger, clock);

        reporter.Report("Secret", "/first", "trace-1");
        Assert.Single(logger.Collector.GetSnapshot());
        Assert.Equal(LogLevel.Error, logger.Collector.GetSnapshot().Single().Level);
        Assert.Contains("Secret", logger.Collector.GetSnapshot().Single().Message);
        Assert.Contains("/first", logger.Collector.GetSnapshot().Single().Message);
        Assert.Contains("trace-1", logger.Collector.GetSnapshot().Single().Message);

        clock.Timestamp = 4999;
        reporter.Report("Other", "/second", "trace-2");
        Assert.Single(logger.Collector.GetSnapshot());

        clock.Timestamp = 5000;
        reporter.Report("Secret", "/third", "trace-3");
        Assert.Equal(2, logger.Collector.Count);
        Assert.Contains(logger.Collector.GetSnapshot(), record => record.Message.Contains("trace-3"));
    }

    [Fact]
    public void Report_ConcurrentRequestsLogOnlyOncePerWindow()
    {
        var clock = new TestTimeProvider();
        var logger = new FakeLogger<AuthenticationUnavailableReporter>();
        var reporter = new AuthenticationUnavailableReporter(logger, clock);

        Parallel.For(0, 100, i => reporter.Report("Secret", "/test", i.ToString()));
        Assert.Single(logger.Collector.GetSnapshot());

        clock.Timestamp = 5000;
        Parallel.For(0, 100, i => reporter.Report("Secret", "/test", i.ToString()));
        Assert.Equal(2, logger.Collector.Count);
    }

    private sealed class TestTimeProvider : TimeProvider
    {
        public long Timestamp { get; set; }
        public override long TimestampFrequency => 1000;
        public override long GetTimestamp() => Timestamp;
    }
}
