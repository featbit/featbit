namespace Domain.Identity;

public record IdentityOptions
{
    public const string Identity = nameof(Identity);

    public string Issuer { get; set; } = string.Empty;

    public string Audience { get; set; } = string.Empty;

    public string Key { get; set; } = string.Empty;
}