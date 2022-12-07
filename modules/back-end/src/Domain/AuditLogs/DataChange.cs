using System.Text.Json;

namespace Domain.AuditLogs;

public class DataChange
{
    public string Previous { get; set; }

    public string Current { get; set; }

    public DataChange(object from)
    {
        Previous = JsonSerializer.Serialize(from, ReusableJsonSerializerOptions.Web);
    }

    public DataChange To(object to)
    {
        Current = JsonSerializer.Serialize(to, ReusableJsonSerializerOptions.Web);

        return this;
    }
}