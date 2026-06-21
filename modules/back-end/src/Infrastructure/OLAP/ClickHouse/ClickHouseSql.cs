using System.Globalization;

namespace Infrastructure.OLAP.ClickHouse;

internal static class ClickHouseSql
{
    public static string String(string value)
    {
        return $"'{value.Replace("\\", "\\\\").Replace("'", "\\'")}'";
    }

    public static string NullableString(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? "NULL" : String(value.Trim());
    }

    public static string Uuid(Guid value)
    {
        return $"toUUID('{value}')";
    }

    public static string DateTime64(DateTimeOffset value)
    {
        return $"toDateTime64('{value.UtcDateTime:yyyy-MM-dd HH:mm:ss.ffffff}', 6, 'UTC')";
    }

    public static string DateTime64(DateTime value)
    {
        var utc = value.Kind == DateTimeKind.Utc ? value : DateTime.SpecifyKind(value, DateTimeKind.Utc);
        return $"toDateTime64('{utc:yyyy-MM-dd HH:mm:ss.ffffff}', 6, 'UTC')";
    }

    public static string Int(int value)
    {
        return value.ToString(CultureInfo.InvariantCulture);
    }
}
