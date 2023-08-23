using System.Text.Json;

namespace Domain.AuditLogs;

public class DataChange
{
    public string Previous { get; set; }

    public string Current { get; set; }

    public DataChange(object from)
    {
        Previous = from == null
            ? string.Empty
            : JsonSerializer.Serialize(from, ReusableJsonSerializerOptions.Web);

        Current = string.Empty;
    }

    public DataChange To(object to)
    {
        Current = to == null
            ? string.Empty
            : JsonSerializer.Serialize(to, ReusableJsonSerializerOptions.Web);

        return this;
    }
    
    public T DeserializePrevious<T>() where T : class
    {
        return string.IsNullOrWhiteSpace(Previous) ? null : JsonSerializer.Deserialize<T>(Previous, ReusableJsonSerializerOptions.Web);
    }
    
    public T DeserializeCurrent<T>() where T : class
    {
        return string.IsNullOrWhiteSpace(Current) ? null : JsonSerializer.Deserialize<T>(Previous, ReusableJsonSerializerOptions.Web);
    }
}