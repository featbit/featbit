using System.Text.Json;
using Application.Bases.Exceptions;

namespace Application.ReleaseHealth;

public static class Schema
{
    public static JsonElement Json(object value) => JsonSerializer.SerializeToElement(value, new JsonSerializerOptions(JsonSerializerDefaults.Web));
    public static BusinessException Invalid(string code) => new("release_health." + code);
    public static void Fields(JsonElement element, params string[] allowed)
    {
        if (element.ValueKind != JsonValueKind.Object) throw Invalid("invalid_schema");
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var property in element.EnumerateObject())
            if (!allowed.Contains(property.Name) || !seen.Add(property.Name)) throw Invalid("invalid_schema");
    }
    public static string Text(JsonElement element, string name, int max = 2048)
    {
        if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty(name, out var property) || property.ValueKind != JsonValueKind.String) throw Invalid("invalid_schema");
        var text = property.GetString()!;
        if (string.IsNullOrWhiteSpace(text) || text.Length > max || text.Any(char.IsControl)) throw Invalid("invalid_schema");
        return text;
    }
    public static int Integer(JsonElement element, string name, int min, int max)
    {
        if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty(name, out var property) || property.ValueKind != JsonValueKind.Number || !property.TryGetInt32(out var value) || value < min || value > max) throw Invalid("invalid_schema");
        return value;
    }
    public static (double Minimum, double Maximum) ResultContract(JsonElement contract)
    {
        Fields(contract, "schemaVersion", "resultKind", "cardinality", "measurementKind", "unit", "constraints");
        Integer(contract, "schemaVersion", 1, 1);
        if (Text(contract, "resultKind") != "numeric_time_series" || Text(contract, "cardinality") != "single") throw Invalid("invalid_result_contract");
        if (!contract.TryGetProperty("unit", out var unit)) throw Invalid("invalid_result_contract");
        var kind = Text(unit, "kind");
        var compatible = Text(contract, "measurementKind") switch
        {
            "gauge" => kind is "count" or "percent" or "ratio" or "duration" or "data",
            "count" => kind == "count", "ratio" => kind is "percent" or "ratio", "rate" => kind == "rate", _ => false
        };
        if (!compatible) throw Invalid("invalid_result_contract");
        switch (kind)
        {
            case "count": Fields(unit, "kind"); break;
            case "percent": case "ratio":
                Fields(unit, "kind", "scale");
                if (Text(unit, "scale") != (kind == "percent" ? "zero_to_one_hundred" : "zero_to_one")) throw Invalid("invalid_result_contract");
                break;
            case "duration": case "data":
                Fields(unit, "kind", "base");
                if (Text(unit, "base") != (kind == "duration" ? "millisecond" : "byte")) throw Invalid("invalid_result_contract");
                break;
            case "rate":
                Fields(unit, "kind", "numerator", "per");
                if (Text(unit, "numerator") is not ("events" or "requests" or "errors" or "operations" or "items" or "bytes") || Text(unit, "per") is not ("second" or "minute" or "hour")) throw Invalid("invalid_result_contract");
                break;
        }
        if (!contract.TryGetProperty("constraints", out var constraints)) throw Invalid("invalid_result_contract");
        Fields(constraints, "minimum", "maximum", "allowNaN", "allowInfinity");
        foreach (var name in new[] { "allowNaN", "allowInfinity" })
            if (!constraints.TryGetProperty(name, out var flag) || flag.ValueKind != JsonValueKind.False) throw Invalid("invalid_result_contract");
        var minimum = 0d;
        var maximum = kind == "percent" ? 100d : kind == "ratio" ? 1d : double.MaxValue;
        if (constraints.TryGetProperty("minimum", out var min))
        {
            if (min.ValueKind != JsonValueKind.Number || !min.TryGetDouble(out var value) || !double.IsFinite(value) || value < minimum) throw Invalid("invalid_result_contract");
            minimum = value;
        }
        if (constraints.TryGetProperty("maximum", out var max))
        {
            if (max.ValueKind != JsonValueKind.Number || !max.TryGetDouble(out var value) || !double.IsFinite(value) || value > maximum) throw Invalid("invalid_result_contract");
            maximum = value;
        }
        if (minimum > maximum) throw Invalid("invalid_result_contract");
        return (minimum, maximum);
    }
}
