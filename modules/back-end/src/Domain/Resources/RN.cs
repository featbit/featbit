namespace Domain.Resources;

public static class RN
{
    public static bool TryParse(string rnString, out ICollection<TypeKeyProps> props)
    {
        props = [];
        if (string.IsNullOrWhiteSpace(rnString))
        {
            return false;
        }

        var span = rnString.AsSpan();

        while (span.Length > 0)
        {
            var colonPosition = span.IndexOf(':');

            var typeAndKeySpan = colonPosition == -1
                ? span
                : span[..colonPosition];

            var slashPosition = typeAndKeySpan.IndexOf('/');
            // no slash or slash is the first or last character
            if (slashPosition == -1 || slashPosition == typeAndKeySpan.Length - 1)
            {
                props = [];
                return false;
            }

            props.Add(new TypeKeyProps
            {
                Type = typeAndKeySpan[..slashPosition].ToString(),
                Key = typeAndKeySpan[(slashPosition + 1)..].ToString()
            });

            if (colonPosition == -1)
            {
                break;
            }

            // move to the next segment
            span = span[(colonPosition + 1)..];
        }

        return true;
    }

    public static bool IsInScope(string rn, string scope) => $"{rn}:".StartsWith($"{scope}:");
}

public record TypeKeyProps
{
    public string Type { get; init; }

    public string Key { get; init; }
}