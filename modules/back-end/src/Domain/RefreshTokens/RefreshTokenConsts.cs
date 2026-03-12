namespace Domain.RefreshTokens;

public static class RefreshTokenConsts
{
    public const int ExpiryDays = 30;

    public static readonly TimeSpan CookieMaxAge = TimeSpan.FromDays(30);
}