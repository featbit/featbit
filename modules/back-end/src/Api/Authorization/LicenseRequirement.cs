using Domain.Workspaces;

namespace Api.Authorization;

public class LicenseRequirement : IAuthorizationRequirement
{
    public string Feature { get; }

    public LicenseRequirement(string feature)
    {
        if (!LicenseFeatures.IsDefined(feature))
        {
            throw new ArgumentException($"The feature '{feature}' is not defined.", nameof(feature));
        }

        Feature = feature;
    }

    public override string ToString()
    {
        return $"LicenseRequirement: {Feature}";
    }
}