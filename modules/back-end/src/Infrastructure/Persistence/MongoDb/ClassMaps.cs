using Domain.ControlPlane;
using Domain.FeatureFlags;
using Domain.Organizations;
using Domain.Users;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Bson.Serialization.Options;
using MongoDB.Bson.Serialization.Serializers;

namespace Infrastructure.Persistence.MongoDb;

public static class ClassMaps
{
    public static void Register()
    {
        if (BsonClassMap.IsClassMapRegistered(typeof(FeatureFlag)))
        {
            return;
        }

        BsonClassMap.RegisterClassMap<FeatureFlag>(map =>
        {
            map.AutoMap();
            map.MapMember(x => x.Tags).SetDefaultValue(Array.Empty<string>());
        });

        BsonClassMap.RegisterClassMap<User>(map =>
        {
            map.AutoMap();
            map.MapMember(x => x.Origin).SetDefaultValue(UserOrigin.Local);
        });

        BsonClassMap.RegisterClassMap<Organization>(map =>
        {
            map.AutoMap();
            map.MapMember(x => x.DefaultPermissions).SetDefaultValue(new OrganizationPermissions());
            map.MapMember(x => x.Settings).SetDefaultValue(new OrganizationSetting());
        });

        BsonClassMap.RegisterClassMap<DcLease>(map =>
        {
            map.AutoMap();

            // The applied-watermark map is keyed by Guid. By default the driver serializes a
            // dictionary with non-string keys as an array of key/value pairs, which prevents
            // dotted-path $set updates like "appliedWatermarks.{envId}". Force the Document
            // representation so each environment id becomes a field name we can target directly.
            map.MapMember(x => x.AppliedWatermarks).SetSerializer(
                new DictionaryInterfaceImplementerSerializer<Dictionary<Guid, long>>(
                    DictionaryRepresentation.Document, new GuidSerializer(BsonType.String), new Int64Serializer()
                )
            );
        });
    }
}