using System.Diagnostics.CodeAnalysis;

namespace Streaming.Shared;

// reference: modules/back-end/src/Domain/Utils/GuidHelper.cs
[ExcludeFromCodeCoverage]
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

    public static Guid Decode(ReadOnlySpan<char> encoded)
    {
        Span<char> chars = stackalloc char[24];
        encoded.CopyTo(chars);
        chars[22] = '=';
        chars[23] = '=';

        for (var i = 0; i < 24; i++)
        {
            if (chars[i] == '_')
            {
                chars[i] = '/';
            }

            if (chars[i] == '-')
            {
                chars[i] = '+';
            }
        }

        Span<byte> bytes = stackalloc byte[16];
        return Convert.TryFromBase64Chars(chars, bytes, out _)
            ? new Guid(bytes)
            : Guid.Empty;
    }
}