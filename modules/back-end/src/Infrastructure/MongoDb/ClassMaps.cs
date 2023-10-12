using Domain.FeatureFlags;
using Domain.Users;
using MongoDB.Bson.Serialization;

namespace Infrastructure.MongoDb;

public static class ClassMaps
{
    public static void Register()
    {
        if (!BsonClassMap.IsClassMapRegistered(typeof(FeatureFlag)))
        {
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
        }
    }
}