using System.Collections.Immutable;
using System.Text;
using System.Text.Json.Nodes;
using Infrastructure.Caches;

namespace Infrastructure.Fakes;

public class FakeCachePopulatingService : ICachePopulatingService
{
    public Task PopulateAsync()
    {
        var flags = ReadJsonArray("flags.json");
        var segments = ReadJsonArray("segments.json");

        FakeCache.Populate(flags, segments);

        return Task.CompletedTask;
    }

    private static JsonArray ReadJsonArray(string path)
    {
        var jString = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Fakes", path));
        var jArray = JsonNode.Parse(jString)!.AsArray();

        return jArray;
    }
}