namespace Domain.Streaming;

public struct Token
{
    public byte Position { get; set; }

    public byte ContentLength { get; set; }

    public long Timestamp { get; set; }

    public string EnvSecret { get; set; }

    public bool IsValid { get; set; }

    public Token(ReadOnlySpan<char> tokenSpan)
    {
        // init values
        Position = 0;
        ContentLength = 0;
        Timestamp = 0;
        EnvSecret = string.Empty;
        IsValid = false;

        if (tokenSpan.IsEmpty || tokenSpan.Length < 5)
        {
            // invalid token
            return;
        }

        var headerSpan = tokenSpan[..5];
        Position = TokenNumber.DecodeByte(headerSpan[..3]);
        ContentLength = TokenNumber.DecodeByte(headerSpan[3..]);

        var payloadSpan = tokenSpan[5..];
        if (payloadSpan.Length < Position + ContentLength)
        {
            // invalid token
            return;
        }

        Timestamp = TokenNumber.DecodeLong(payloadSpan.Slice(Position, ContentLength));

        var padding = Array.Empty<char>();
        var secretLength = payloadSpan.Length - ContentLength;
        if (secretLength % 4 != 0)
        {
            padding = new char[4 - secretLength % 4];
            Array.Fill(padding, '=');
        }

        var envSecret = string.Concat(
            payloadSpan[..Position],
            payloadSpan[(Position + ContentLength)..],
            padding
        );
        EnvSecret = envSecret;

        IsValid = true;
    }
}