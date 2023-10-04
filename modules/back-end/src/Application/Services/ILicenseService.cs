using Application.License;

namespace Application.Services;

public interface ILicenseService
{
    /// <summary>
    /// Verify license for organization
    /// </summary>
    /// <param name="orgId"></param>
    /// <returns> The <see cref="LicenseData"/> if the license is valid or null otherwise. </returns>
    Task<LicenseData?> VerifyLicenseAsync(Guid orgId);
}