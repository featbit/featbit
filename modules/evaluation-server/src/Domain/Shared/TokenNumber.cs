namespace Domain.Shared;

public static class TokenNumber
{
    private static readonly long MinTimestamp = DateTimeOffset.MinValue.ToUnixTimeMilliseconds();
    private static readonly long MaxTimestamp = DateTimeOffset.MaxValue.ToUnixTimeMilliseconds();

    private static readonly Dictionary<char, char> CharacterMap = new()
    {
        { 'Q', '0' },
        { 'B', '1' },
        { 'W', '2' },
        { 'S', '3' },
        { 'P', '4' },
        { 'H', '5' },
        { 'D', '6' },
        { 'X', '7' },
        { 'Z', '8' },
        { 'U', '9' },
    };

    public static bool TryDecodeByte(ReadOnlySpan<char> characters, out byte value)
    {
        value = 0;
        if (characters.IsEmpty || characters.IsWhiteSpace())
        {
            return true;
        }

        Span<char> chars = stackalloc char[characters.Length];
        for (var i = 0; i < chars.Length; i++)
        {
            if (!CharacterMap.TryGetValue(characters[i], out var charValue))
            {
                return false;
            }

            chars[i] = charValue;
        }

        return byte.TryParse(chars, out value);
    }
    
    public static bool TryDecodeTimestamp(ReadOnlySpan<char> characters, out long value)
    {
        value = 0;
        if (characters.IsEmpty || characters.IsWhiteSpace())
        {
            return true;
        }

        Span<char> chars = stackalloc char[characters.Length];
        for (var i = 0; i < chars.Length; i++)
        {
            if (!CharacterMap.TryGetValue(characters[i], out var charValue))
            {
                return false;
            }

            chars[i] = charValue;
        }

        if (!long.TryParse(chars, out var timestamp) || timestamp < MinTimestamp || timestamp > MaxTimestamp)
        {
            return false;
        }

        value = timestamp;
        return true;
    }
}