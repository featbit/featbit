namespace Application.Identity;

public class LoginResult
{
    public bool Success { get; private init; }

    public string ErrorCode { get; private init; } = string.Empty;

    public string Token { get; private init; } = string.Empty;

    public static LoginResult Failed(string errorCode)
    {
        var failed = new LoginResult
        {
            Success = false,
            ErrorCode = errorCode,
            Token = string.Empty
        };

        return failed;
    }

    public static LoginResult Ok(string token)
    {
        var success = new LoginResult
        {
            Success = true,
            ErrorCode = string.Empty,
            Token = token
        };

        return success;
    }
}