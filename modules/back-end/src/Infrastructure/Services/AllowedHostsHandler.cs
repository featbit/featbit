namespace Infrastructure.Services;

/// <summary>
/// Sends a request for a listed host through <c>trusted</c> and every other request through <c>guarded</c>, the
/// handler that enforces the AntiSSRF policy.
/// <para>
/// A listed host is matched by its exact name, case-insensitively, and on any port. Subdomains are not matched.
/// The trusted handler must not follow redirects: a listed host that answers with a redirect would otherwise
/// lead the request to an address nothing has checked. Its redirect response is returned as it is.
/// </para>
/// </summary>
internal sealed class AllowedHostsHandler : HttpMessageHandler
{
    private readonly HashSet<string> _allowedHosts;
    private readonly HttpMessageInvoker _trusted;
    private readonly HttpMessageInvoker _guarded;

    public AllowedHostsHandler(IEnumerable<string> allowedHosts, HttpMessageHandler trusted, HttpMessageHandler guarded)
    {
        _allowedHosts = new HashSet<string>(allowedHosts.Select(Normalize), StringComparer.OrdinalIgnoreCase);
        _trusted = new HttpMessageInvoker(trusted);
        _guarded = new HttpMessageInvoker(guarded);
    }

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var uri = request.RequestUri;
        var listed = uri is { IsAbsoluteUri: true } && _allowedHosts.Contains(Normalize(uri.Host));

        return (listed ? _trusted : _guarded).SendAsync(request, cancellationToken);
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _trusted.Dispose();
            _guarded.Dispose();
        }

        base.Dispose(disposing);
    }

    // An IPv6 literal is written in brackets in a URL and without them in a setting.
    private static string Normalize(string host) => host.Trim().TrimStart('[').TrimEnd(']');
}
