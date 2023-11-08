namespace Domain.Workspaces;

public record License
{
    private const string LicenseIssuer = "https://www.featbit.co";

    public string Sub { get; set; } = string.Empty;

    public long Iat { get; set; }

    public long Exp { get; set; }

    public Guid WsId { get; set; } = Guid.Empty;

    public string Issuer { get; set; } = string.Empty;

    public string Plan { get; set; } = string.Empty;

    public ICollection<string> Features { get; set; } = Array.Empty<string>();

    public bool IsValid(Guid workspaceId)
    {
        // check organization
        if (WsId != workspaceId)
        {
            return false;
        }

        // check issuer
        if (Issuer != LicenseIssuer)
        {
            return false;
        }

        // check expiration
        if (DateTimeOffset.FromUnixTimeMilliseconds(Exp) < DateTimeOffset.UtcNow)
        {
            return false;
        }

        return true;
    }

    public bool IsGranted(string feature) => Features.Contains(feature) || Features.Contains(LicenseFeatures.Asterisk);
}