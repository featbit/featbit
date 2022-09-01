namespace Domain.Utils.ExtensionMethods;

public static class DateTimeExtensions
{
    public static long ToUnixTimeMilliseconds(this DateTime dateTime)
    {
        var milliseconds = new DateTimeOffset(dateTime).ToUnixTimeMilliseconds();

        return milliseconds;
    }
}