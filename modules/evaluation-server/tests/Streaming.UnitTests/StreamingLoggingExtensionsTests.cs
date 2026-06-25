using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Testing;

namespace Streaming.UnitTests;

public class StreamingLoggingExtensionsTests
{
    private readonly FakeLogger _logger = new();

    [Fact]
    public void RequestRejected_FormatsMessageAndCarriesEventName()
    {
        _logger.RequestRejected("ws://x/?token=abc", "missing-type");

        var record = Assert.Single(_logger.Collector.GetSnapshot());
        Assert.Equal(LogLevel.Warning, record.Level);
        Assert.Equal(1, record.Id.Id);
        Assert.Equal("RequestRejected", record.Id.Name);
        Assert.Equal("Streaming request was rejected: ws://x/?token=abc. Reason: missing-type.", record.Message);
    }

    [Fact]
    public void RequestRejected_NullRequest_RendersAsNullPlaceholder()
    {
        _logger.RequestRejected(null, "no-type");

        var record = Assert.Single(_logger.Collector.GetSnapshot());
        Assert.Equal(LogLevel.Warning, record.Level);
        Assert.Contains("no-type", record.Message);
    }

    [Fact]
    public void FailedToResolveHost_FormatsMessageAndCapturesException()
    {
        var ex = new InvalidOperationException("dns down");

        _logger.FailedToResolveHost("10.0.0.1", ex);

        var record = Assert.Single(_logger.Collector.GetSnapshot());
        Assert.Equal(LogLevel.Warning, record.Level);
        Assert.Equal(2, record.Id.Id);
        Assert.Equal("FailedToResolveHost", record.Id.Name);
        Assert.Equal("Failed to resolve host for IP address: 10.0.0.1.", record.Message);
        Assert.Same(ex, record.Exception);
    }

    [Fact]
    public void ErrorValidateRequest_FormatsMessageAndCapturesException()
    {
        var ex = new InvalidOperationException("bad");

        _logger.ErrorValidateRequest("ws://x", ex);

        var record = Assert.Single(_logger.Collector.GetSnapshot());
        Assert.Equal(LogLevel.Error, record.Level);
        Assert.Equal(3, record.Id.Id);
        Assert.Equal("ErrorValidateRequest", record.Id.Name);
        Assert.Equal("Exception occurred while validating request: ws://x.", record.Message);
        Assert.Same(ex, record.Exception);
    }
}
