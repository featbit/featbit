namespace Streaming.Shared;

public static class TokenNumber
{
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

        value = byte.Parse(chars);
        return true;
    }
    
    public static bool TryDecodeLong(ReadOnlySpan<char> characters, out long value)
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

        value = long.Parse(chars);
        return true;
    }
}