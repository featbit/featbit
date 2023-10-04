namespace Application.Services;

public interface ILicenseService
{
    Task<bool> VerifyLicenseAsync(Guid orgId, string licenseItem);
}