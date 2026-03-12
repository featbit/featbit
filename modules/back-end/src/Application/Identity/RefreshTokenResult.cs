namespace Application.Identity;

public class RefreshTokenResult
{
    public bool Success { get; set; }
    
    public string AccessToken { get; private init; } = string.Empty;
    
    public string RefreshToken { get; private init; } = string.Empty;
    
    public string ErrorCode { get; private init; } = string.Empty;

    public static RefreshTokenResult Failed(string errorCode)
    {
        return new RefreshTokenResult
        {
            Success = false,
            ErrorCode = errorCode,
            AccessToken = string.Empty,
            RefreshToken =  string.Empty
        };
    }

    public static RefreshTokenResult Succeed(string accessToken, string? refreshToken = null)
    {
        return new RefreshTokenResult
        {
            Success = true,
            ErrorCode = string.Empty,
            AccessToken = accessToken,
            RefreshToken = refreshToken
        };
    }
}