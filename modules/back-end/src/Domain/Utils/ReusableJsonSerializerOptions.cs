using System.Text.Json;

namespace Domain.Utils;

public static class ReusableJsonSerializerOptions
{
    public static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);
}