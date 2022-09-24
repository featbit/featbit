namespace Domain.Identity;

public record JwtOptions
{
    public const string Jwt = nameof(Jwt);

    public string Issuer { get; set; } = string.Empty;

    public string Audience { get; set; } = string.Empty;

    public string Key { get; set; } = string.Empty;
}