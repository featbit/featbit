using System.Text.Json.Nodes;
using Infrastructure.Caches;

namespace Infrastructure.Fakes;

public class FakeCachePopulatingService : ICachePopulatingService
{
    public Task PopulateAsync()
    {
        var flags = ReadAsJsonArray(@"Fakes\flags.json");
        var segments = ReadAsJsonArray(@"Fakes\segments.json");

        FakeCache.Populate(flags, segments);

        return Task.CompletedTask;
    }

    private static JsonArray ReadAsJsonArray(string path)
    {
        var json = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, path));
        var jArray = JsonNode.Parse(json)!.AsArray();

        return jArray;
    }
}