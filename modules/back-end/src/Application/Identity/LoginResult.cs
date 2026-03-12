namespace Application.Identity;

public class LoginResult
{
    public bool Success { get; private init; }

    public string ErrorCode { get; private init; } = string.Empty;

    public AuthTokens Tokens { get; private init; }

    public static LoginResult Failed(string errorCode)
    {
        var failed = new LoginResult
        {
            Success = false,
            ErrorCode = errorCode,
            Tokens = null
        };

        return failed;
    }

    public static LoginResult Ok(AuthTokens tokens)
    {
        var success = new LoginResult
        {
            Success = true,
            ErrorCode = string.Empty,
            Tokens = tokens
        };

        return success;
    }
}