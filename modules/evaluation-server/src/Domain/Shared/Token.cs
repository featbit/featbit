﻿namespace Domain.Shared;

public struct Token
{
    public byte Position { get; set; }

    public byte ContentLength { get; set; }

    public long Timestamp { get; set; }

    public string SecretString { get; set; }

    public bool IsValid { get; set; }

    public Token(ReadOnlySpan<char> tokenSpan)
    {
        // init values
        Position = 0;
        ContentLength = 0;
        Timestamp = 0;
        SecretString = string.Empty;
        IsValid = false;

        #region token header

        if (tokenSpan.IsEmpty || tokenSpan.Length < 5)
        {
            // invalid token: token header must be 5 characters
            return;
        }

        var headerSpan = tokenSpan[..5];
        if (!TokenNumber.TryDecodeByte(headerSpan[..3], out var position))
        {
            // invalid token: invalid position
            return;
        }

        if (!TokenNumber.TryDecodeByte(headerSpan[3..], out var contentLength))
        {
            // invalid token: invalid contentLength
            return;
        }

        Position = position;
        ContentLength = contentLength;

        #endregion

        #region token payload: timestamp

        var payloadSpan = tokenSpan[5..];
        if (payloadSpan.Length < Position + ContentLength)
        {
            // invalid token: incomplete token payload
            return;
        }

        if (!TokenNumber.TryDecodeLong(payloadSpan.Slice(Position, ContentLength), out var timestamp))
        {
            // invalid token: invalid timestamp
            return;
        }

        Timestamp = timestamp;

        #endregion

        #region token payload: envSecret

        var padding = Array.Empty<char>();
        var secretLength = payloadSpan.Length - ContentLength;
        if (secretLength % 4 != 0)
        {
            padding = new char[4 - secretLength % 4];
            Array.Fill(padding, '=');
        }

        var secretString = string.Concat(
            payloadSpan[..Position],
            payloadSpan[(Position + ContentLength)..],
            padding
        );
        if (string.IsNullOrWhiteSpace(secretString) || secretString.Length != 44)
        {
            // invalid token: invalid secret
            return;
        }
        SecretString = secretString;

        #endregion

        IsValid = true;
    }
}