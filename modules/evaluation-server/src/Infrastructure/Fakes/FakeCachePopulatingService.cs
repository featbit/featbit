using System.Collections.Immutable;
using System.Text.Json.Nodes;
using Infrastructure.Caches;

namespace Infrastructure.Fakes;

public class FakeCachePopulatingService : ICachePopulatingService
{
    public Task PopulateAsync()
    {
        var flags = ReadAsDictionary(@"Fakes\flags.json");
        var segments = ReadAsDictionary(@"Fakes\segments.json");

        FakeCache.Populate(flags, segments);

        return Task.CompletedTask;
    }

    private static ImmutableDictionary<string, JsonObject> ReadAsDictionary(string path)
    {
        var json = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, path));
        var dictionary =
            JsonNode.Parse(json)!.AsArray().ToImmutableDictionary(x => x["id"].ToString(), x => x.AsObject());

        return dictionary;
    }
}