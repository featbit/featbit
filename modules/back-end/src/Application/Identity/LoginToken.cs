namespace Application.Identity;

public record LoginToken(bool IsSsoFirstLogin, string Token);