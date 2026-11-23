using System.Net;
using System.Net.Http.Headers;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using Application.ReleaseMetricSourceConnections;
using Microsoft.Security.AntiSSRF;

namespace Infrastructure.Services;

public sealed class PrometheusConnectionTester(HttpClient client) : IPrometheusConnectionTester
{
    private const int MaxResponseBytes = 64 * 1024;
    private static readonly IPNetwork GlobalIpv6Unicast = IPNetwork.Parse("2000::/3");
    private static readonly IPNetwork[] BlockedNetworks =
        IPAddressRanges.recommendedLatest.Select(IPNetwork.Parse).ToArray();

    internal static HttpMessageHandler CreateHandler() => new SocketsHttpHandler
    {
        UseProxy = false,
        AllowAutoRedirect = false,
        UseCookies = false,
        ActivityHeadersPropagator = null,
        ConnectTimeout = TimeSpan.FromSeconds(3),
        MaxResponseDrainSize = 0,
        ConnectCallback = ConnectAsync
    };

    public async Task<ConnectionTestResult> TestAsync(
        Uri endpoint, string? username, string? password, string? bearerToken, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (endpoint.Scheme != Uri.UriSchemeHttps &&
            (endpoint.Scheme != Uri.UriSchemeHttp || bearerToken != null || username != null || password != null))
        {
            return new("unavailable", "invalid_configuration");
        }

        using var budget = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        budget.CancelAfter(TimeSpan.FromSeconds(8));
        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint.AbsoluteUri.TrimEnd('/') + "/api/v1/query")
        {
            Content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["query"] = "vector(1)",
                ["timeout"] = "5s"
            })
        };
        if (bearerToken != null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearerToken);
        }
        else if (username != null)
        {
            var credentials = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{username}:{password}"));
            request.Headers.Authorization = new AuthenticationHeaderValue("Basic", credentials);
        }

        try
        {
            using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, budget.Token);
            if (!response.IsSuccessStatusCode)
            {
                return new("unavailable", response.StatusCode switch
                {
                    HttpStatusCode.Unauthorized => "authentication_failed",
                    HttpStatusCode.Forbidden => "access_denied",
                    HttpStatusCode.RequestTimeout or HttpStatusCode.GatewayTimeout => "timeout",
                    _ => "provider_error"
                });
            }

            // Enforce the same limit for chunked responses as for responses with a Content-Length.
            await response.Content.LoadIntoBufferAsync(MaxResponseBytes, budget.Token);
            using var body = await response.Content.ReadAsStreamAsync(budget.Token);
            var jsonOptions = new JsonDocumentOptions { AllowDuplicateProperties = false };
            using var json = await JsonDocument.ParseAsync(body, jsonOptions, budget.Token);
            return IsExpectedVector(json.RootElement) ? new("connected", null) : new("unavailable", "invalid_response");
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return new("unavailable", "timeout");
        }
        catch (JsonException)
        {
            return new("unavailable", "invalid_response");
        }
        catch (HttpRequestException ex)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var reason = ex.GetBaseException() switch
            {
                TargetNotAllowedException => "target_not_allowed",
                TimeoutException => "timeout",
                _ when ex.HttpRequestError == HttpRequestError.ConfigurationLimitExceeded => "invalid_response",
                _ => "unreachable"
            };
            return new("unavailable", reason);
        }
        catch (IOException)
        {
            cancellationToken.ThrowIfCancellationRequested();
            return new("unavailable", "unreachable");
        }
    }

    private static bool IsExpectedVector(JsonElement root)
    {
        if (root.ValueKind != JsonValueKind.Object || root.TryGetProperty("warnings", out _) ||
            !HasString(root, "status", "success") || !root.TryGetProperty("data", out var data) ||
            data.ValueKind != JsonValueKind.Object || !HasString(data, "resultType", "vector") ||
            !data.TryGetProperty("result", out var result) ||
            result.ValueKind != JsonValueKind.Array || result.GetArrayLength() != 1)
        {
            return false;
        }

        var item = result[0];
        return item.ValueKind == JsonValueKind.Object && item.TryGetProperty("value", out var sample) &&
            sample.ValueKind == JsonValueKind.Array && sample.GetArrayLength() == 2 &&
            sample[1].ValueKind == JsonValueKind.String && sample[1].ValueEquals("1");
    }

    private static bool HasString(JsonElement obj, string name, string expected) =>
        obj.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String && value.ValueEquals(expected);

    private static async ValueTask<Stream> ConnectAsync(SocketsHttpConnectionContext context, CancellationToken token)
    {
        var target = context.DnsEndPoint;
        var addresses = await Dns.GetHostAddressesAsync(target.Host, token);
        if (addresses.Any(IsBlocked))
        {
            throw new TargetNotAllowedException();
        }

        // Connect to the addresses we checked, keeping the original hostname for TLS validation.
        var socket = new Socket(SocketType.Stream, ProtocolType.Tcp) { NoDelay = true };
        try
        {
            await socket.ConnectAsync(addresses, target.Port, token);
            return new NetworkStream(socket, ownsSocket: true);
        }
        catch
        {
            socket.Dispose();
            throw;
        }
    }

    private static bool IsBlocked(IPAddress address)
    {
        var ip = address.IsIPv4MappedToIPv6 ? address.MapToIPv4() : address;
        return (ip.AddressFamily == AddressFamily.InterNetworkV6 && !GlobalIpv6Unicast.Contains(ip)) ||
            BlockedNetworks.Any(network => network.Contains(ip));
    }

    private sealed class TargetNotAllowedException : Exception;
}
