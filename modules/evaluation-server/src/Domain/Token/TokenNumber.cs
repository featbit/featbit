namespace Domain.Token;

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

    public static ReadOnlySpan<char> Decode(ReadOnlySpan<char> characters)
    {
        if (characters.IsEmpty || characters.IsWhiteSpace())
        {
            return ReadOnlySpan<char>.Empty;
        }

        var number = new char[characters.Length];
        for (var i = 0; i < characters.Length; i++)
        {
            number[i] = CharacterMap[characters[i]];
        }

        return number;
    }
}