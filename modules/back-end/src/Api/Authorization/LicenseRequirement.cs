using Application.License;

namespace Api.Authorization;

public class LicenseRequirement : IAuthorizationRequirement
{
    public string LicenseFeature { get; }

    public LicenseRequirement(string licenseFeature)
    {
        if (!LicenseFeatures.IsDefined(licenseFeature))
        {
            throw new ArgumentException($"The item '{licenseFeature}' is not defined.", nameof(licenseFeature));
        }

        LicenseFeature = licenseFeature;
    }

    public override string ToString()
    {
        return $"LicenseRequirement: {LicenseFeature}";
    }
}