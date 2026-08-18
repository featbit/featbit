using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Domain.Utils;
using Microsoft.Extensions.Options;

namespace Infrastructure.OLAP.ClickHouse;

public class ClickHouseClient(HttpClient httpClient, IOptions<ClickHouseOptions> options)
{
    private readonly ClickHouseOptions _options = options.Value;

    public async Task<T[]> QueryAsync<T>(string sql, CancellationToken cancellationToken = default)
    {
        var content = await ExecuteAsync($"{sql}\nFORMAT JSONEachRow", cancellationToken);
        if (string.IsNullOrWhiteSpace(content))
        {
            return [];
        }

        var rows = new List<T>();
        foreach (var line in content.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            rows.Add(JsonSerializer.Deserialize<T>(line, ReusableJsonSerializerOptions.Web)!);
        }

        return rows.ToArray();
    }

    public async Task ExecuteCommandAsync(string sql, CancellationToken cancellationToken = default)
    {
        await ExecuteAsync(sql, cancellationToken);
    }

    private async Task<string> ExecuteAsync(string sql, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, BuildUri())
        {
            Content = new StringContent(sql, Encoding.UTF8, "text/plain")
        };

        if (!string.IsNullOrWhiteSpace(_options.User))
        {
            var credential = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{_options.User}:{_options.Password}"));
            request.Headers.Authorization = new AuthenticationHeaderValue("Basic", credential);
        }

        using var response = await httpClient.SendAsync(request, cancellationToken);
        var content = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"ClickHouse query failed with HTTP {(int)response.StatusCode}: {content}");
        }

        return content;
    }

    private Uri BuildUri()
    {
        var builder = new UriBuilder(_options.HttpEndpoint);
        if (!string.IsNullOrWhiteSpace(_options.Database))
        {
            builder.Query = $"database={Uri.EscapeDataString(_options.Database)}";
        }

        return builder.Uri;
    }
}
