namespace Domain.Streaming;

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

    public static byte DecodeByte(ReadOnlySpan<char> characters)
    {
        if (characters.IsEmpty || characters.IsWhiteSpace())
        {
            return 0;
        }

        Span<char> chars = stackalloc char[characters.Length];
        for (var i = 0; i < chars.Length; i++)
        {
            chars[i] = CharacterMap[characters[i]];
        }

        return byte.Parse(chars);
    }

    public static long DecodeLong(ReadOnlySpan<char> characters)
    {
        if (characters.IsEmpty || characters.IsWhiteSpace())
        {
            return 0;
        }

        Span<char> chars = stackalloc char[characters.Length];
        for (var i = 0; i < chars.Length; i++)
        {
            chars[i] = CharacterMap[characters[i]];
        }

        return long.Parse(chars);
    }
}