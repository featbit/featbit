namespace Application.Identity;

public class ResetPasswordResult
{
    public bool Success { get; set; }

    public string Reason { get; set; }

    public static ResetPasswordResult Failed(string reason)
    {
        return new ResetPasswordResult
        {
            Success = false,
            Reason = reason
        };
    }

    public static ResetPasswordResult Ok()
    {
        return new ResetPasswordResult
        {
            Success = true,
            Reason = string.Empty
        };
    }
}