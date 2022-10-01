namespace Domain.Users;

public static class PasswordGenerator
{
    public static string New(string key)
    {
        var origin = $"{Guid.NewGuid()}__{key}";
        var bytes = System.Text.Encoding.UTF8.GetBytes(origin);
        
        return Convert.ToBase64String(bytes)[..12];
    }
}