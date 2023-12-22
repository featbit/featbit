using System.Text.Json;

namespace Domain.AuditLogs;

public class DataChange
{
    public string Previous { get; set; }

    public string Current { get; set; }

    public DataChange()
    {
        Previous = string.Empty;
        Current = string.Empty;
    }

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

    public bool IsCreation() => string.IsNullOrWhiteSpace(Previous);

    public bool IsDeletion() => string.IsNullOrWhiteSpace(Current);

    public bool IsCreationOrDeletion() => IsCreation() || IsDeletion();
}