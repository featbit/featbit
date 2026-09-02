using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Application.ReleaseHealth;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Security.AntiSSRF;

namespace Infrastructure.ReleaseHealth;

public sealed class PrometheusProvider(IConfiguration configuration, IHostEnvironment environment) : IMetricSourceProvider
{
    public string Type => "prometheus-compatible";
    public int SchemaVersion => 1;
    private readonly SemaphoreSlim _requests = new(8);

    public ProviderConnection Validate(ConnectionWrite write, ProviderConnection? existing)
    {
        Schema.Fields(write.ProviderConfig, "endpoint");
        var endpoint = Endpoint(Schema.Text(write.ProviderConfig, "endpoint"));
        var auth = Schema.Text(write.Authentication, "type");
        if (auth is not ("none" or "bearer_token" or "basic")) throw Schema.Invalid("unsupported_authentication");
        Schema.Fields(write.Authentication, auth == "basic" ? ["type", "username"] : ["type"]);
        var username = auth == "basic" ? Schema.Text(write.Authentication, "username", 256) : null;
        if (username?.Contains(':') == true) throw Schema.Invalid("invalid_basic_username");
        var operation = Schema.Text(write.SecretUpdate, "operation");
        Dictionary<string, string> secrets = [];
        if (auth == "none")
        {
            Schema.Fields(write.SecretUpdate, "operation");
            if (operation != "remove") throw Schema.Invalid("secret_remove_required");
        }
        else if (operation == "keep")
        {
            Schema.Fields(write.SecretUpdate, "operation");
            if (existing is null || Schema.Text(existing.Authentication, "type") != auth || existing.Secrets.Count != 1)
                throw Schema.Invalid("secret_replace_required");
            secrets = new(existing.Secrets);
        }
        else if (operation == "replace")
        {
            var field = auth == "basic" ? "password" : "token";
            Schema.Fields(write.SecretUpdate, "operation", field);
            var secret = Schema.Text(write.SecretUpdate, field, 8192);
            if (auth == "bearer_token" && (secret.Any(char.IsWhiteSpace) || secret.Any(c => c > 127))) throw Schema.Invalid("invalid_bearer_token");
            secrets[field] = secret;
        }
        else throw Schema.Invalid("secret_replace_required");
        return new(Schema.Json(new { endpoint = endpoint.AbsoluteUri.TrimEnd('/') }),
            username is null ? Schema.Json(new { type = auth }) : Schema.Json(new { type = auth, username }), secrets);
    }

    public JsonElement ReadAuthentication(ProviderConnection connection, DateTimeOffset? rotatedAt)
    {
        var type = Schema.Text(connection.Authentication, "type");
        return type switch
        {
            "none" => Schema.Json(new { type, secretState = "not_configured" }),
            "basic" => Schema.Json(new { type, username = Schema.Text(connection.Authentication, "username"), secretState = "configured", lastRotatedAt = rotatedAt }),
            _ => Schema.Json(new { type, secretState = "configured", lastRotatedAt = rotatedAt })
        };
    }

    public JsonElement ValidateBinding(JsonElement value)
    {
        Schema.Fields(value, "promql", "queryMode", "step");
        if (!value.TryGetProperty("promql", out var queryValue) || queryValue.ValueKind != JsonValueKind.String) throw Schema.Invalid("invalid_query");
        var query = queryValue.GetString()!;
        if (string.IsNullOrWhiteSpace(query) || query.Length > 4096 || query.Contains('\0')) throw Schema.Invalid("invalid_query");
        if (Schema.Text(value, "queryMode") != "range" || Schema.Text(value, "step") is not ("5s" or "15s" or "1m" or "5m")) throw Schema.Invalid("invalid_query_configuration");
        return value.Clone();
    }

    public async Task TestAsync(ProviderConnection connection, CancellationToken ct)
    {
        using var json = await Request(connection, "query?query=vector%281%29&timeout=5s", ct);
        try
        {
            var data = json.RootElement.GetProperty("data");
            if (data.GetProperty("resultType").GetString() != "vector" || data.GetProperty("result").GetArrayLength() != 1 ||
                data.GetProperty("result")[0].GetProperty("value")[1].GetString() != "1") throw Schema.Invalid("invalid_test_response");
        }
        catch (Exception ex) when (ex is KeyNotFoundException or InvalidOperationException or IndexOutOfRangeException)
        { throw Schema.Invalid("invalid_test_response"); }
    }

    public async Task<IReadOnlyList<MetricPoint>> QueryAsync(ProviderConnection connection, JsonElement binding,
        DateTimeOffset start, DateTimeOffset end, CancellationToken ct)
    {
        ValidateBinding(binding);
        var query = Uri.EscapeDataString(binding.GetProperty("promql").GetString()!);
        var step = Schema.Text(binding, "step");
        using var json = await Request(connection, $"query_range?query={query}&start={start.ToUnixTimeSeconds()}&end={end.ToUnixTimeSeconds()}&step={step}&timeout=5s", ct);
        return ParseRange(json.RootElement, start, end);
    }

    public static IReadOnlyList<MetricPoint> ParseRange(JsonElement response, DateTimeOffset start, DateTimeOffset end)
    {
        try
        {
            var data = response.GetProperty("data");
            if (data.GetProperty("resultType").GetString() != "matrix") throw Schema.Invalid("single_series_required");
            var series = data.GetProperty("result");
            if (series.GetArrayLength() == 0) return [];
            if (series.GetArrayLength() != 1) throw Schema.Invalid("single_series_required");
            var values = series[0].GetProperty("values");
            if (values.GetArrayLength() > 1000) throw Schema.Invalid("too_many_points");
            List<MetricPoint> points = [];
            DateTimeOffset? previous = null;
            foreach (var value in values.EnumerateArray())
            {
                if (value.GetArrayLength() != 2 || !value[0].TryGetDouble(out var seconds) || !double.IsFinite(seconds) ||
                    seconds < start.ToUnixTimeSeconds() || seconds > end.ToUnixTimeSeconds() ||
                    !double.TryParse(value[1].GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var number) || !double.IsFinite(number)) throw Schema.Invalid("invalid_point");
                var timestamp = DateTimeOffset.FromUnixTimeMilliseconds((long)(seconds * 1000));
                if (previous is not null && timestamp <= previous) throw Schema.Invalid("invalid_point_order");
                previous = timestamp;
                points.Add(new(timestamp, number));
            }
            return points;
        }
        catch (Exception ex) when (ex is KeyNotFoundException or InvalidOperationException or IndexOutOfRangeException or FormatException)
        { throw Schema.Invalid("invalid_provider_response"); }
    }

    internal Uri Endpoint(string value)
    {
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri) || uri.Scheme is not ("https" or "http") ||
            !string.IsNullOrEmpty(uri.UserInfo) || !string.IsNullOrEmpty(uri.Query) || !string.IsNullOrEmpty(uri.Fragment)) throw Schema.Invalid("invalid_endpoint");
        if (uri.Scheme != "https" && !IsLocalFixture(uri)) throw Schema.Invalid("https_required");
        return uri;
    }

    private bool IsLocalFixture(Uri uri) => environment.IsDevelopment() &&
        IPAddress.TryParse(uri.DnsSafeHost, out var ip) && IPAddress.IsLoopback(ip) &&
        (configuration.GetSection("ReleaseHealth:Development:AllowedLoopbackOrigins").Get<string[]>() ?? [])
        .Contains(uri.GetLeftPart(UriPartial.Authority), StringComparer.OrdinalIgnoreCase);

    private async Task<JsonDocument> Request(ProviderConnection connection, string operation, CancellationToken ct)
    {
        var endpoint = Endpoint(Schema.Text(connection.Configuration, "endpoint"));
        if (!await _requests.WaitAsync(0, ct)) throw Schema.Invalid("provider_busy");
        try
        {
            // A narrowly scoped, explicit Development-only loopback exception for the integration fixture.
            // All other connections use FeatBit's existing AntiSSRF package, with redirects/cookies disabled.
            HttpMessageHandler handler;
            if (IsLocalFixture(endpoint)) handler = new SocketsHttpHandler { AllowAutoRedirect = false, UseProxy = false, UseCookies = false, ConnectTimeout = TimeSpan.FromSeconds(3) };
            else
            {
                var guarded = new AntiSSRFPolicy(PolicyConfigOptions.ExternalOnlyLatest) { AllowPlainTextHttp = false, AddXFFHeader = false }.GetHandler();
                guarded.AllowAutoRedirect = false;
                guarded.UseCookies = false;
                guarded.ConnectTimeout = TimeSpan.FromSeconds(3);
                handler = guarded;
            }
            using var client = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(8) };
            // Prometheus query APIs support read-only POST. Keep PromQL out of URL/access logs.
            var parts = operation.Split('?', 2);
            using var request = new HttpRequestMessage(HttpMethod.Post, endpoint.AbsoluteUri.TrimEnd('/') + "/api/v1/" + parts[0]);
            request.Content = new StringContent(parts[1], Encoding.UTF8, "application/x-www-form-urlencoded");
            var auth = Schema.Text(connection.Authentication, "type");
            if (auth == "bearer_token") request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", connection.Secrets["token"]);
            if (auth == "basic") request.Headers.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(Encoding.UTF8.GetBytes(Schema.Text(connection.Authentication, "username") + ":" + connection.Secrets["password"])));
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(8));
            using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, timeout.Token);
            if (response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden) throw Schema.Invalid("provider_authentication_failed");
            if (!response.IsSuccessStatusCode) throw Schema.Invalid("provider_request_failed");
            const int limit = 1024 * 1024;
            if (response.Content.Headers.ContentLength > limit) throw Schema.Invalid("response_too_large");
            await using var stream = await response.Content.ReadAsStreamAsync(timeout.Token);
            using var buffer = new MemoryStream();
            var block = new byte[8192];
            int size;
            while ((size = await stream.ReadAsync(block, timeout.Token)) > 0)
            {
                if (buffer.Length + size > limit) throw Schema.Invalid("response_too_large");
                buffer.Write(block, 0, size);
            }
            var json = JsonDocument.Parse(buffer.ToArray());
            if (!json.RootElement.TryGetProperty("status", out var status) || status.GetString() != "success" ||
                json.RootElement.TryGetProperty("warnings", out _))
            { json.Dispose(); throw Schema.Invalid("provider_request_failed"); }
            return json;
        }
        // Never return provider bodies, URLs, request headers, or raw transport exceptions.
        catch (OperationCanceledException) when (!ct.IsCancellationRequested) { throw Schema.Invalid("provider_timeout"); }
        catch (Exception ex) when (ex is HttpRequestException or JsonException) { throw Schema.Invalid("provider_unavailable"); }
        catch (Exception ex) when (ex is not Application.Bases.Exceptions.BusinessException && !ct.IsCancellationRequested) { throw Schema.Invalid("provider_unavailable"); }
        finally { _requests.Release(); }
    }
}
