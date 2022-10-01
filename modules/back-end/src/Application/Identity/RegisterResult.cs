namespace Application.Identity;

public class RegisterResult
{
    public Guid UserId { get; set; }

    public string Token { get; set; }

    public bool Success { get; set; }

    public string Message { get; set; }

    public static RegisterResult Failed(string message)
    {
        var failed = new RegisterResult
        {
            UserId = Guid.Empty,
            Token = string.Empty,
            Success = false,
            Message = message
        };

        return failed;
    }

    public static RegisterResult Ok(Guid userId, string token)
    {
        var success = new RegisterResult
        {
            UserId = userId,
            Token = token,
            Success = true,
            Message = string.Empty
        };

        return success;
    }
}