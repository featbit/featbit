using System.Runtime.CompilerServices;
using Infrastructure.Webhooks;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Bson.Serialization.Conventions;
using MongoDB.Bson.Serialization.IdGenerators;
using MongoDB.Bson.Serialization.Serializers;

namespace Infrastructure;

public static class Initialization
{
#pragma warning disable CA2255
    [ModuleInitializer]
#pragma warning restore CA2255
    public static void Run()
    {
        var conventions = new ConventionPack
        {
            new IgnoreExtraElementsConvention(true),
            new CamelCaseElementNameConvention()
        };
        ConventionRegistry.Register("global-conventions", conventions, _ => true);

        // guid handling
#pragma warning disable 618
        BsonDefaults.GuidRepresentationMode = GuidRepresentationMode.V3;
#pragma warning restore
        BsonSerializer.RegisterSerializer(new GuidSerializer(GuidRepresentation.Standard));
        BsonSerializer.RegisterIdGenerator(
            typeof(Guid),
            CombGuidGenerator.Instance
        );

        // register custom class mapping
        ClassMaps.Register();

        // register handlebars helpers
        HandlebarsHelpers.RegisterHelpers();
    }
}