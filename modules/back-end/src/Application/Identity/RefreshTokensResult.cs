namespace Application.Identity;

public class RefreshTokensResult
{
    public bool Success { get; set; }

    public AuthTokens Tokens { get; set; }

    public string ErrorCode { get; private init; } = string.Empty;

    public static RefreshTokensResult Failed(string errorCode)
    {
        return new RefreshTokensResult
        {
            Success = false,
            Tokens = null,
            ErrorCode = errorCode
        };
    }

    public static RefreshTokensResult Succeed(AuthTokens tokens)
    {
        return new RefreshTokensResult
        {
            Success = true,
            Tokens = tokens,
            ErrorCode = string.Empty
        };
    }
}