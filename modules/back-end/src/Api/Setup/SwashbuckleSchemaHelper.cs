namespace Api.Setup;

public static class SwashbuckleSchemaHelper
{
    private static readonly Dictionary<string, List<string>> _schemaNameRegistrations = [];

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


    public static string GetSchemaId(Type modelType)
    {
        string id = DefaultSchemaIdSelector(modelType);

        if (!_schemaNameRegistrations.ContainsKey(id))
        {
            _schemaNameRegistrations[id] = [];
        }

        var registrations = _schemaNameRegistrations[id];

        var fullname = modelType.FullName ?? string.Empty;
        if (!string.IsNullOrWhiteSpace(fullname) && !registrations.Contains(fullname))
        {
            registrations.Add(fullname);
        }

        var index = registrations.IndexOf(fullname);
        return index == 0 ? id : $"{id}{index + 1}";
    }
}