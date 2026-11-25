using System.Text.Json;
using Domain.ReleaseMetricSourceConnections;
using Domain.Utils;
using MongoDB.Bson;
using MongoDB.Bson.IO;
using MongoDB.Bson.Serialization;
using MongoDB.Bson.Serialization.Serializers;

namespace Infrastructure.Persistence.MongoDb;

// The provider-specific fields are JSON objects. Store them as nested BSON
// documents so the Mongo driver does not reflect over JsonElement itself.
internal sealed class ReleaseMetricSourceConnectionSettingsSerializer : SerializerBase<ReleaseMetricSourceConnectionSettings>
{
    public override void Serialize(BsonSerializationContext context, BsonSerializationArgs args, ReleaseMetricSourceConnectionSettings value)
    {
        var json = JsonSerializer.Serialize(value, ReusableJsonSerializerOptions.Web);
        BsonDocumentSerializer.Instance.Serialize(context, BsonDocument.Parse(json));
    }

    public override ReleaseMetricSourceConnectionSettings Deserialize(BsonDeserializationContext context, BsonDeserializationArgs args)
    {
        var document = BsonDocumentSerializer.Instance.Deserialize(context);
        var json = document.ToJson(new JsonWriterSettings { OutputMode = JsonOutputMode.RelaxedExtendedJson });
        return JsonSerializer.Deserialize<ReleaseMetricSourceConnectionSettings>(json, ReusableJsonSerializerOptions.Web)!;
    }
}
