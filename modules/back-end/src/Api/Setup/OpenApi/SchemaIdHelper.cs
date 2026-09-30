using System.Text.Json.Serialization.Metadata;

namespace Api.Setup.OpenApi;

public static class SchemaIdHelper
{
    private static readonly Dictionary<string, List<string>> SchemaNameRegistrations = [];

    // from https://github.com/domaindrivendev/Swashbuckle.AspNetCore/blob/master/src/Swashbuckle.AspNetCore.SwaggerGen/SchemaGenerator/SchemaGeneratorOptions.cs#L43
    private static string DefaultSchemaIdSelector(Type modelType)
    {
        if (!modelType.IsConstructedGenericType)
        {
            return modelType.Name.Replace("[]", "Array");
        }

        var prefix = modelType.GetGenericArguments()
            .Select(DefaultSchemaIdSelector)
            .Aggregate((previous, current) => previous + current);

        return prefix + modelType.Name.Split('`').First();
    }

    public static string GetSchemaId(JsonTypeInfo typeInfo) => GetSchemaId(typeInfo.Type);

    public static string GetSchemaId(Type modelType)
    {
        var id = DefaultSchemaIdSelector(modelType);

        if (!SchemaNameRegistrations.TryGetValue(id, out var registrations))
        {
            registrations = [];
            SchemaNameRegistrations[id] = registrations;
        }

        var fullname = modelType.FullName ?? string.Empty;
        if (!string.IsNullOrWhiteSpace(fullname) && !registrations.Contains(fullname))
        {
            registrations.Add(fullname);
        }

        var index = registrations.IndexOf(fullname);
        return index == 0 ? id : $"{id}{index + 1}";
    }
}
