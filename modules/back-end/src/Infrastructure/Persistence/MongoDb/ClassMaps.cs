using Domain.FeatureFlags;
using Domain.Organizations;
using Domain.Users;
using MongoDB.Bson.Serialization;

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
        });
    }
}