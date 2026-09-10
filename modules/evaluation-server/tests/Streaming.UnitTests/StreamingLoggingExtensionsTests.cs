using Domain.Observability;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Testing;

namespace Streaming.UnitTests;

public class StreamingLoggingExtensionsTests
{
    private const string QueryString = "?type=client&token=abc123&version=2";
    private const string Token = "ZWQwMy1jYTQzLTQ1ZDgtOTU2MC1lZDViOTNiZGRjNTY=";

    private readonly FakeLogger _logger = new();

    private string Message() => Assert.Single(_logger.Collector.GetSnapshot()).Message;

    [Fact]
    public void RequestRejected_FormatsMessageAndCarriesEventName()
    {
        _logger.RequestRejected(QueryString, "missing-type");

        var record = Assert.Single(_logger.Collector.GetSnapshot());
        Assert.Equal(LogLevel.Warning, record.Level);
        Assert.Equal(1, record.Id.Id);
        Assert.Equal("RequestRejected", record.Id.Name);
        Assert.Equal(
            $"Streaming request was rejected: {Redaction.QueryString(QueryString)}. Reason: missing-type.",
            record.Message);
    }

    [Fact]
    public void RequestRejected_NullRequest_RendersAsNonePlaceholder()
    {
        _logger.RequestRejected(null, "no-type");

        var record = Assert.Single(_logger.Collector.GetSnapshot());
        Assert.Equal(LogLevel.Warning, record.Level);
        Assert.Contains("no-type", record.Message);
        Assert.Contains(Redaction.None, record.Message);
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
        Assert.Equal($"Failed to resolve host for IP address: 10.0.0.1.", record.Message);
        Assert.Same(ex, record.Exception);
    }

    [Fact]
    public void ErrorValidateRequest_FormatsMessageAndCapturesException()
    {
        var ex = new InvalidOperationException("bad");

        _logger.ErrorValidateRequest(QueryString, ex);

        var record = Assert.Single(_logger.Collector.GetSnapshot());
        Assert.Equal(LogLevel.Error, record.Level);
        Assert.Equal(3, record.Id.Id);
        Assert.Equal("ErrorValidateRequest", record.Id.Name);
        Assert.Equal(
            $"Exception occurred while validating request: {Redaction.QueryString(QueryString)}.",
            record.Message);
        Assert.Same(ex, record.Exception);
    }

    // The tests below are the point of the redaction wrapper: they assert on what must *never*
    // appear in output, so reinstating a raw value at any of these call sites fails the build
    // rather than silently leaking a credential (docs/observability/index.md §7).

    [Fact]
    public void RequestRejected_WithATokenInTheQueryString_NeverLogsItRaw()
    {
        _logger.RequestRejected(QueryString, "invalid-token");

        var message = Message();
        Assert.DoesNotContain("abc123", message);
        Assert.Contains("token", message);
    }

    [Fact]
    public void RequestValidationUnavailable_WithATokenInTheQueryString_NeverLogsItRaw()
    {
        _logger.RequestValidationUnavailable(QueryString, "store-unavailable");

        Assert.DoesNotContain("abc123", Message());
    }

    [Fact]
    public void ErrorValidateRequest_WithATokenInTheQueryString_NeverLogsItRaw()
    {
        _logger.ErrorValidateRequest(QueryString, new InvalidOperationException("bad"));

        Assert.DoesNotContain("abc123", Message());
    }

    [Fact]
    public void RequestRejected_WithNonCredentialParameters_KeepsThemLegible()
    {
        // Redaction is credential-only: everything that is not a credential stays readable, which
        // is what makes a rejected request diagnosable (docs/observability/index.md §7).
        _logger.RequestRejected(QueryString, "invalid-token");

        var message = Message();
        Assert.Contains("type=client", message);
        Assert.Contains("version=2", message);
    }

    [Fact]
    public void FailedToResolveHost_ForAFailedLookup_LogsTheClientAddress()
    {
        // The address is deliberately logged raw: it is operator-facing diagnostic data, not a
        // credential.
        _logger.FailedToResolveHost("203.0.113.7", new InvalidOperationException("dns down"));

        Assert.Contains("203.0.113.7", Message());
    }

    [Fact]
    public void ErrorLookupRelayProxyToken_ForAnyToken_NeverLogsItRaw()
    {
        _logger.ErrorLookupRelayProxyToken(Token, new InvalidOperationException("boom"));

        var message = Message();
        Assert.DoesNotContain(Token, message);
        Assert.Contains(Redaction.Token(Token), message);
    }

    [Fact]
    public void ErrorLookupSecretToken_ForAnyToken_NeverLogsItRaw()
    {
        _logger.ErrorLookupSecretToken(Token, new InvalidOperationException("boom"));

        var message = Message();
        Assert.DoesNotContain(Token, message);
        Assert.Contains(Redaction.Token(Token), message);
    }

    [Fact]
    public void FailedToParseToken_ForAnyToken_NeverLogsItRaw()
    {
        _logger.FailedToParseToken(Token, new FormatException("nope"));

        var message = Message();
        Assert.DoesNotContain(Token, message);
        Assert.Contains(Redaction.Token(Token), message);
    }

    [Fact]
    public void Events_AcrossTheWholeClass_KeepTheirIdAndName()
    {
        // Alerting is keyed on these, so the redaction refactor must not have renumbered anything.
        _logger.RequestRejected(QueryString, "r");
        _logger.FailedToResolveHost("10.0.0.1", new Exception());
        _logger.ErrorValidateRequest(QueryString, new Exception());
        _logger.ErrorLookupRelayProxyToken(Token, new Exception());
        _logger.ErrorLookupSecretToken(Token, new Exception());
        _logger.RequestValidationUnavailable(QueryString, "r");
        _logger.FailedToParseToken(Token, new Exception());

        var ids = _logger.Collector.GetSnapshot().Select(x => (x.Id.Id, x.Id.Name)).ToArray();

        Assert.Equal(
        [
            (1, "RequestRejected"),
            (2, "FailedToResolveHost"),
            (3, "ErrorValidateRequest"),
            (4, "ErrorLookupRelayProxyToken"),
            (5, "ErrorLookupSecretToken"),
            (6, "RequestValidationUnavailable"),
            (7, "FailedToParseToken")
        ], ids);
    }
}
