using System.Text.Json;

namespace Domain.Utils;

public class ReusableJsonSerializerOptions
{
    public static JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);
}