namespace Application.Identity;

public record LoginResult
{
    public bool Success { get; private init; }

    public string Message { get; private init; } = string.Empty;

    public string Token { get; private init; } = string.Empty;

    public static LoginResult Failed(string message)
    {
        var failed = new LoginResult
        {
            Success = false,
            Message = message,
            Token = string.Empty
        };

        return failed;
    }

    public static LoginResult Ok(string token)
    {
        var success = new LoginResult
        {
            Success = true,
            Message = string.Empty,
            Token = token
        };

        return success;
    }
}