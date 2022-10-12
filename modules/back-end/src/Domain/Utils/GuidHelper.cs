namespace Domain.Utils;

public static class GuidHelper
{
    public static string Encode(Guid guid)
    {
        var encoded = Convert
            .ToBase64String(guid.ToByteArray())
            .Replace("/", "_")
            .Replace("+", "-");

        return encoded[..22];
    }

    public static Guid Decode(string encoded)
    {
        var actual = encoded
            .Replace("_", "/")
            .Replace("-", "+");

        var buffer = Convert.FromBase64String(actual + "==");
        return new Guid(buffer);
    }
}