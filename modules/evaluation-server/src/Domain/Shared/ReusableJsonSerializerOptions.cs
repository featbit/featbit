using System.Text.Json;

namespace Domain.Shared;

public class ReusableJsonSerializerOptions
{
    // https://learn.microsoft.com/en-us/dotnet/standard/serialization/system-text-json/configure-options?pivots=dotnet-6-0#web-defaults-for-jsonserializeroptions
    public static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);
}