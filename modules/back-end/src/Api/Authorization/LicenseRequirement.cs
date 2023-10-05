namespace Api.Authorization;

public class LicenseRequirement : IAuthorizationRequirement
{
    public string LicenseItem { get; }

    public LicenseRequirement(string licenseItem)
    {
        if (!LicenseItems.IsDefined(licenseItem))
        {
            throw new ArgumentException($"The item '{licenseItem}' is not defined.", nameof(licenseItem));
        }

        LicenseItem = licenseItem;
    }

    public override string ToString()
    {
        return $"LicenseRequirement: {LicenseItem}";
    }
}