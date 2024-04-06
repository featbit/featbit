namespace Application.Identity;

public record LoginToken(bool IsFirstLogin, string Token);