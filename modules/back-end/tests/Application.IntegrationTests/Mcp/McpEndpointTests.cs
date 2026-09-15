using System.Net;
using System.Net.Http.Headers;
using System.Net.Mime;
using System.Text;
using System.Text.Json;

namespace Application.IntegrationTests.Mcp;

/// <summary>
/// Endpoint-level coverage for the MCP server that the tool unit tests cannot provide.
/// Those construct the *McpTools classes directly, so they never exercise
/// AddMcpServer/WithHttpTransport/WithToolsFromAssembly, the MapMcp("/mcp") route, or its
/// RequireAuthorization() gate. This suite drives the real Streamable HTTP transport so a
/// regression in registration, tool discovery, or authorization fails the build.
/// </summary>
[Trait("Category", "Host")]
[Collection(nameof(TestApp))]
public class McpEndpointTests
{
    private const string McpEndpoint = "/mcp";
    private const string ProtocolVersion = "2024-11-05";

    private readonly TestApp _app;

    public McpEndpointTests(TestApp app)
    {
        _app = app;
    }

    [Fact]
    public async Task McpEndpoint_UnauthenticatedRequest_IsRejected()
    {
        using var client = _app.CreateClient();

        using var response = await SendRpcAsync(client, "tools/list");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.True(
            response.Headers.WwwAuthenticate.Count > 0,
            "Expected a WWW-Authenticate header on the 401 from the MCP endpoint.");
    }

    [Fact]
    public async Task McpEndpoint_Initialize_CompletesHandshakeAndAdvertisesTools()
    {
        using var client = await _app.CreateAuthenticatedClientAsync(_app);

        using var response = await SendRpcAsync(client, "initialize", new
        {
            protocolVersion = ProtocolVersion,
            capabilities = new { },
            clientInfo = new { name = "featbit-integration-tests", version = "1.0.0" }
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await ReadRpcResultAsync(response);

        // Proves AddMcpServer().WithHttpTransport() is wired into the pipeline and speaking MCP.
        Assert.False(string.IsNullOrWhiteSpace(result.GetProperty("protocolVersion").GetString()));
        Assert.True(
            result.GetProperty("capabilities").TryGetProperty("tools", out _),
            "Expected the server to advertise the 'tools' capability.");
    }

    [Fact]
    public async Task McpEndpoint_ToolsList_ReturnsToolsDiscoveredFromAssembly()
    {
        using var client = await _app.CreateAuthenticatedClientAsync(_app);

        using var response = await SendRpcAsync(client, "tools/list");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await ReadRpcResultAsync(response);
        var toolNames = result
            .GetProperty("tools")
            .EnumerateArray()
            .Select(tool => tool.GetProperty("name").GetString())
            .ToHashSet(StringComparer.Ordinal);

        // WithToolsFromAssembly() must discover every [McpServerToolType] in the Api assembly.
        // One representative tool per class keeps this resilient to new tools being added.
        string[] expected =
        [
            "featbit_experiment_get_feature_flag",
            "featbit_experiment_toggle_feature_flag",
            "featbit_experiment_get_experiment",
            "featbit_experiment_list_metrics",
            "featbit_experiment_list_layers"
        ];

        foreach (var tool in expected)
        {
            Assert.Contains(tool, toolNames);
        }
    }

    [Fact]
    public async Task McpEndpoint_ToolsCall_UnknownTool_ReturnsProtocolErrorNotServerCrash()
    {
        using var client = await _app.CreateAuthenticatedClientAsync(_app);

        using var response = await SendRpcAsync(client, "tools/call", new
        {
            name = "featbit_tool_that_does_not_exist",
            arguments = new { }
        });

        // The transport must surface unknown tools as a JSON-RPC error rather than a 5xx.
        Assert.True(
            response.StatusCode is HttpStatusCode.OK or HttpStatusCode.BadRequest,
            $"Expected a protocol-level response, got {(int)response.StatusCode}.");

        var payload = await ReadRpcMessageAsync(response);
        Assert.True(
            payload.TryGetProperty("error", out _) ||
            payload.GetProperty("result").GetProperty("isError").GetBoolean(),
            "Expected an MCP error for an unknown tool.");
    }

    /// <summary>
    /// Builds and sends a JSON-RPC request to the MCP endpoint, accepting either
    /// response shape the Streamable HTTP transport may choose.
    /// </summary>
    private static Task<HttpResponseMessage> SendRpcAsync(
        HttpClient client,
        string method,
        object? parameters = null)
    {
        var payload = new Dictionary<string, object>
        {
            ["jsonrpc"] = "2.0",
            ["id"] = 1,
            ["method"] = method
        };

        if (parameters is not null)
        {
            payload["params"] = parameters;
        }

        var request = new HttpRequestMessage(HttpMethod.Post, McpEndpoint)
        {
            Content = new StringContent(
                JsonSerializer.Serialize(payload),
                Encoding.UTF8,
                MediaTypeNames.Application.Json)
        };

        // Streamable HTTP lets the server answer with either JSON or an SSE stream.
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue(MediaTypeNames.Application.Json));
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("text/event-stream"));

        return client.SendAsync(request);
    }

    /// <summary>
    /// Reads a successful JSON-RPC response and returns its <c>result</c> payload,
    /// failing with the JSON-RPC error when the call did not succeed.
    /// </summary>
    private static async Task<JsonElement> ReadRpcResultAsync(HttpResponseMessage response)
    {
        var message = await ReadRpcMessageAsync(response);

        Assert.False(
            message.TryGetProperty("error", out var error),
            $"MCP call failed: {error}");

        return message.GetProperty("result");
    }

    /// <summary>
    /// Parses the JSON-RPC envelope from a response body, unwrapping the SSE framing first
    /// when the transport answered with an event stream rather than plain JSON.
    /// </summary>
    private static async Task<JsonElement> ReadRpcMessageAsync(HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync();
        var mediaType = response.Content.Headers.ContentType?.MediaType;
        var json = mediaType == "text/event-stream" ? ExtractSseData(body) : body;

        Assert.False(
            string.IsNullOrWhiteSpace(json),
            $"Expected a JSON-RPC message from {McpEndpoint}, got '{body}'.");

        using var document = JsonDocument.Parse(json);
        return document.RootElement.Clone();
    }

    /// <summary>
    /// Extracts the payload of the first SSE event in the body. Scoped to a single event
    /// because concatenating the data lines of several events would yield invalid JSON;
    /// multi-line data within that one event is rejoined with newlines per the SSE spec.
    /// </summary>
    private static string ExtractSseData(string body)
    {
        var data = body
            .Split('\n')
            .Select(line => line.TrimEnd('\r'))
            .SkipWhile(line => !line.StartsWith("data:", StringComparison.Ordinal))
            .TakeWhile(line => line.Length > 0)
            .Where(line => line.StartsWith("data:", StringComparison.Ordinal))
            .Select(line => line["data:".Length..].TrimStart());

        return string.Join('\n', data);
    }
}
