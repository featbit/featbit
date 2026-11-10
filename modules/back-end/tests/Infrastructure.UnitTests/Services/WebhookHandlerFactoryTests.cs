using System.Net;
using System.Net.Sockets;
using System.Text;
using Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Security.AntiSSRF;

namespace Infrastructure.UnitTests.Services;

public class WebhookHandlerFactoryTests
{
    // ----- reading the setting -----

    [Fact]
    public void GetAllowedAddresses_NotConfigured_ReturnsEmpty()
    {
        var configuration = Configure();

        var result = WebhookHandlerFactory.GetAllowedAddresses(configuration);

        Assert.Empty(result);
    }

    [Fact]
    public void GetAllowedAddresses_Configured_ReturnsTheEntriesTrimmedAndWithoutBlanks()
    {
        var configuration = Configure(
            ("Webhook:AllowedAddresses:0", " 10.0.0.0/8 "),
            ("Webhook:AllowedAddresses:1", ""),
            ("Webhook:AllowedAddresses:2", "192.168.1.5"));

        var result = WebhookHandlerFactory.GetAllowedAddresses(configuration);

        Assert.Equal(["10.0.0.0/8", "192.168.1.5"], result);
    }

    [Fact]
    public void GetAllowedAddresses_AnEntryIsNotAnAddress_FailsAndNamesTheSetting()
    {
        var configuration = Configure(
            ("Webhook:AllowedAddresses:0", "10.0.0.0/8"),
            ("Webhook:AllowedAddresses:1", "not-an-address"));

        var ex = Assert.Throws<InvalidOperationException>(
            () => WebhookHandlerFactory.GetAllowedAddresses(configuration));

        Assert.Contains("Webhook:AllowedAddresses", ex.Message);
        Assert.Contains("not-an-address", ex.Message);
    }

    // ----- what the handler lets through -----

    [Fact]
    public async Task Handler_NoAddressesAllowed_BlocksALoopbackTarget()
    {
        using var server = new LoopbackServer();
        using var client = new HttpClient(WebhookHandlerFactory.CreateHandler([], []));

        await Assert.ThrowsAsync<AntiSSRFException>(() => client.GetAsync(server.Url));
    }

    [Fact]
    public async Task Handler_TheTargetsAddressIsAllowed_SendsTheRequest()
    {
        using var server = new LoopbackServer();
        using var client = new HttpClient(WebhookHandlerFactory.CreateHandler(["127.0.0.1/32"], []));

        var response = await client.GetAsync(server.Url);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Handler_ARangeContainingTheTargetIsAllowed_SendsTheRequest()
    {
        using var server = new LoopbackServer();
        using var client = new HttpClient(WebhookHandlerFactory.CreateHandler(["127.0.0.0/8"], []));

        var response = await client.GetAsync(server.Url);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Theory]
    [InlineData("http://127.0.0.2:1/")] // loopback, but not the allowed address
    [InlineData("http://10.1.1.1:1/")] // private, and not allowed
    [InlineData("http://169.254.169.254/")] // the instance metadata address stays blocked
    public async Task Handler_OnlyOneAddressIsAllowed_StillBlocksTheOthers(string url)
    {
        using var client = new HttpClient(WebhookHandlerFactory.CreateHandler(["127.0.0.1/32"], []));

        await Assert.ThrowsAsync<AntiSSRFException>(() => client.GetAsync(url));
    }

    // ----- reading the hosts setting -----

    [Fact]
    public void GetAllowedHosts_NotConfigured_ReturnsEmpty()
    {
        var result = WebhookHandlerFactory.GetAllowedHosts(Configure());

        Assert.Empty(result);
    }

    [Fact]
    public void GetAllowedHosts_Configured_ReturnsTheEntriesTrimmedAndWithoutBlanks()
    {
        var configuration = Configure(
            ("Webhook:AllowedHosts:0", " notify.internal.example "),
            ("Webhook:AllowedHosts:1", " "),
            ("Webhook:AllowedHosts:2", "chat-gateway"));

        var result = WebhookHandlerFactory.GetAllowedHosts(configuration);

        Assert.Equal(["notify.internal.example", "chat-gateway"], result);
    }

    [Theory]
    [InlineData("http://notify.internal")] // a URL, not a host
    [InlineData("notify.internal:8080")] // a host with a port
    [InlineData("notify.internal/path")]
    [InlineData("*.internal")] // no wildcards: a host is listed by its exact name
    [InlineData("bad host")]
    public void GetAllowedHosts_AnEntryIsNotAHostName_FailsAndNamesTheSetting(string entry)
    {
        var configuration = Configure(("Webhook:AllowedHosts:0", entry));

        var ex = Assert.Throws<InvalidOperationException>(() => WebhookHandlerFactory.GetAllowedHosts(configuration));

        Assert.Contains("Webhook:AllowedHosts", ex.Message);
        Assert.Contains(entry, ex.Message);
    }

    // ----- what the handler lets through for a listed host -----

    [Theory]
    [InlineData("localhost")]
    [InlineData("LOCALHOST")] // host names are not case sensitive
    public async Task Handler_TheTargetsHostIsAllowed_SendsTheRequest(string allowedHost)
    {
        using var server = new LoopbackServer();
        using var client = new HttpClient(WebhookHandlerFactory.CreateHandler([], [allowedHost]));

        var response = await client.GetAsync($"http://localhost:{server.Port}/");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Handler_AHostIsAllowed_StillBlocksOtherHostsThatAreNotPublic()
    {
        using var client = new HttpClient(WebhookHandlerFactory.CreateHandler([], ["localhost"]));

        await Assert.ThrowsAsync<AntiSSRFException>(() => client.GetAsync("http://127.0.0.1:1/"));
    }

    // ----- which handler a request goes to -----

    [Theory]
    [InlineData("http://notify.internal/hook", true)]
    [InlineData("https://NOTIFY.internal:8443/hook?a=1", true)] // any case, port, path or scheme
    [InlineData("http://[::1]:8080/", true)] // an IPv6 literal, listed without brackets
    [InlineData("http://sub.notify.internal/hook", false)] // a subdomain is a different host
    [InlineData("http://notify.internal.evil.example/hook", false)] // a longer name that starts with it
    [InlineData("http://evil-notify.internal/hook", false)] // a name that ends with it
    [InlineData("http://other.internal/hook", false)]
    public async Task AllowedHostsHandler_Request_GoesToTheTrustedHandlerOnlyForAListedHost(string url, bool listed)
    {
        var trusted = new RecordingHandler();
        var guarded = new RecordingHandler();
        using var client = new HttpClient(new AllowedHostsHandler(["notify.internal", "::1"], trusted, guarded));

        await client.GetAsync(url);

        Assert.Equal(listed ? 1 : 0, trusted.Requests);
        Assert.Equal(listed ? 0 : 1, guarded.Requests);
    }

    private sealed class RecordingHandler : HttpMessageHandler
    {
        private int _requests;

        public int Requests => Volatile.Read(ref _requests);

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Interlocked.Increment(ref _requests);
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK));
        }
    }

    [Fact]
    public async Task Handler_AnAllowedHostRedirects_DoesNotFollowTheRedirect()
    {
        // The redirect target is a non-public address that is not allowed. Following it would reach it unchecked.
        using var target = new LoopbackServer();
        using var listed = new LoopbackServer($"HTTP/1.1 302 Found\r\nLocation: {target.Url}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
        using var client = new HttpClient(WebhookHandlerFactory.CreateHandler([], ["localhost"]));

        var response = await client.GetAsync($"http://localhost:{listed.Port}/");

        Assert.Equal(HttpStatusCode.Found, response.StatusCode);
        Assert.Equal(1, listed.Requests);
        Assert.Equal(0, target.Requests);
    }

    private static IConfiguration Configure(params (string Key, string Value)[] values) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(values.Select(v => new KeyValuePair<string, string?>(v.Key, v.Value)))
            .Build();

    /// <summary>A minimal HTTP server on a loopback port. It answers every request with 200 unless told otherwise.</summary>
    private sealed class LoopbackServer : IDisposable
    {
        private readonly TcpListener _listener = new(IPAddress.Loopback, 0);
        private readonly CancellationTokenSource _cts = new();
        private readonly byte[] _response;
        private int _requests;

        public LoopbackServer(string? rawResponse = null)
        {
            _response = Encoding.ASCII.GetBytes(
                rawResponse ?? "HTTP/1.1 200 OK\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
            _listener.Start();
            _ = Task.Run(AcceptAsync);
        }

        public int Port => ((IPEndPoint)_listener.LocalEndpoint).Port;

        public string Url => $"http://127.0.0.1:{Port}/";

        public int Requests => Volatile.Read(ref _requests);

        private async Task AcceptAsync()
        {
            try
            {
                while (!_cts.IsCancellationRequested)
                {
                    using var tcp = await _listener.AcceptTcpClientAsync(_cts.Token);
                    var stream = tcp.GetStream();
                    var buffer = new byte[4096];
                    _ = await stream.ReadAsync(buffer, _cts.Token);
                    Interlocked.Increment(ref _requests);
                    await stream.WriteAsync(_response, _cts.Token);
                }
            }
            catch (Exception)
            {
                // the test finished and the listener was stopped
            }
        }

        public void Dispose()
        {
            _cts.Cancel();
            _listener.Stop();
            _cts.Dispose();
        }
    }
}
