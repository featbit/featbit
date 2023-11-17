namespace Domain.Workspaces;

public class Workspace : AuditedEntity
{
    public string Name { get; set; }

    public string Key { get; set; }

    public string License { get; set; }

    public SsoConfig Sso { get; set; }

    public void Update(string name, string key)
    {
        Name = name;
        Key = key;

        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateLicense(string license)
    {
        License = license;

        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateSsoOidc(OidcConfig oidc)
    {
        Sso ??= new SsoConfig();

        Sso.Oidc = oidc;

        UpdatedAt = DateTime.UtcNow;
    }

    public bool IsFeatureGranted(string feature)
    {
        if (!LicenseFeatures.IsDefined(feature))
        {
            return false;
        }

        var isGranted =
            LicenseVerifier.TryParse(Id, License, out var license) &&
            license.IsGranted(feature);

        return isGranted;
    }
}