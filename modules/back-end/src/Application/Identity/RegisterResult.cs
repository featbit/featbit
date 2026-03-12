using Domain.Users;

namespace Application.Identity;

public class RegisterResult
{
    public User User { get; set; }

    public bool Success { get; set; }

    public string Message { get; set; }

    public static RegisterResult Failed(string message)
    {
        var failed = new RegisterResult
        {
            User = null,
            Success = false,
            Message = message
        };

        return failed;
    }

    public static RegisterResult Ok(User user)
    {
        var success = new RegisterResult
        {
            User = user,
            Success = true,
            Message = string.Empty
        };

        return success;
    }
}