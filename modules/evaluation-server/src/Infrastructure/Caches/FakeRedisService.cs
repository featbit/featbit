using System.Text.Json;
using MongoDB.Bson;
using StackExchange.Redis;
using Moq;

namespace Infrastructure.Caches;

public class FakeRedisService: IRedisService
{
    public FakeRedisService(IConnectionMultiplexer multiplexer)
    {        
    }

    public async Task<IEnumerable<byte[]>> GetFlagsAsync(Guid envId, long timestamp)
    {
        var values = new List<RedisValue>();
        var jsonBytes = values.Select(x => (byte[])x!);

        return jsonBytes;
    }

    public async Task<IEnumerable<byte[]>> GetFlagsAsync(IEnumerable<string> ids)
    {
        var values = new List<RedisValue>();
        var jsonBytes = values.Select(x => (byte[])x!);

        return jsonBytes;
    }

    public async Task UpsertFlagAsync(JsonElement flag)
    {
    }

    public async Task DeleteFlagAsync(Guid envId, Guid flagId)
    {
    }

    public async Task<byte[]> GetSegmentAsync(string id)
    {
        var value = new RedisValue();
        return (byte[])value!;
    }

    public async Task<IEnumerable<byte[]>> GetSegmentsAsync(Guid envId, long timestamp)
    {
        var values = new List<RedisValue>();
        var jsonBytes = values.Select(x => (byte[])x!);

        return jsonBytes;
    }

    public async Task UpsertSegmentAsync(BsonDocument segment)
    {
    }

    public async Task UpsertSegmentAsync(JsonElement segment)
    {
    }

    public async Task DeleteSegmentAsync(Guid envId, Guid segmentId)
    {
    }
}