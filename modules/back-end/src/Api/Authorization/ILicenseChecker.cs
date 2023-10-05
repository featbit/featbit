namespace Api.Authorization;

public interface ILicenseChecker
{
    Task<bool> Verify(Guid orgId, string licenseItem);
}