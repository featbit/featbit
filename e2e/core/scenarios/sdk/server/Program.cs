using System.Text.Json;
using FeatBit.Sdk.Server;
using FeatBit.Sdk.Server.Model;
using FeatBit.Sdk.Server.Options;

var secret = Environment.GetEnvironmentVariable("FB_SERVER_SECRET")
    ?? throw new InvalidOperationException("FB_SERVER_SECRET is required");
var endpoint = Environment.GetEnvironmentVariable("FB_ELS_URL")
    ?? throw new InvalidOperationException("FB_ELS_URL is required");
var flagKey = Environment.GetEnvironmentVariable("FB_FLAG_KEY")
    ?? throw new InvalidOperationException("FB_FLAG_KEY is required");
var prefix = Environment.GetEnvironmentVariable("FB_USER_PREFIX")
    ?? throw new InvalidOperationException("FB_USER_PREFIX is required");

var options = new FbOptionsBuilder(secret)
    .Streaming(new Uri(endpoint.Replace("http://", "ws://").Replace("https://", "wss://")))
    .Event(new Uri(endpoint))
    .DisableEvents(true)
    .Build();
var client = new FbClient(options);
var users = new Dictionary<string, FbUser> {
    ["tester"] = FbUser.Builder($"{prefix}-tester").Name("tester").Custom("role", "tester").Build(),
    ["guest"] = FbUser.Builder($"{prefix}-guest").Name("guest").Custom("role", "guest").Build(),
};
try {
    string? line;
    while ((line = Console.ReadLine()) != null) {
        if (line == "close") break;
        var result = users.ToDictionary(pair => pair.Key, pair => {
            var detail = client.StringVariationDetail(flagKey, pair.Value, "missing");
            return new { value = detail.Value, valueId = detail.ValueId,
                kind = detail.Kind.ToString(), reason = detail.Reason };
        });
        Console.WriteLine(JsonSerializer.Serialize(new { initialized = client.Initialized, result }));
        Console.Out.Flush();
    }
} finally {
    await client.CloseAsync();
}
