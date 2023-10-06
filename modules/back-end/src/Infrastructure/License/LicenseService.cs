using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Application.Caches;
using Application.License;
using Domain.Utils;
using Microsoft.Extensions.Configuration;

namespace Infrastructure.License;

public class LicenseService : ILicenseService
{
    private readonly ICacheService _cacheService;
    private readonly IOrganizationService _organizationService;
    private readonly RSA _rsa;
    
    public LicenseService(
        ICacheService cacheService,
        IOrganizationService organizationService,
        IConfiguration configuration)
    {
        _rsa = RSA.Create();
        LoadPublicKey(configuration["PublicKey"]);
        
        _cacheService = cacheService;
        _organizationService = organizationService;
    }

    private void LoadPublicKey(string publicKey)
    {
        
        publicKey = publicKey.Replace("-----BEGIN PUBLIC KEY-----", "")
            .Replace("-----END PUBLIC KEY-----", "")
            .Replace(Environment.NewLine, "");
        
        _rsa.ImportSubjectPublicKeyInfo(Convert.FromBase64String(publicKey), out _);
    }

    public LicenseData? VerifyLicenseAsync(Guid orgId, string licenseStr)
    {
        if (string.IsNullOrEmpty(licenseStr))
        {
            return null;
        }

        var parts = licenseStr.Split('.');

        try
        {
            var isVerified = _rsa.VerifyData(
                Encoding.UTF8.GetBytes(parts[1]),
                Convert.FromBase64String(parts[0]),
                HashAlgorithmName.SHA256,
                RSASignaturePadding.Pkcs1);

            if (!isVerified)
            {
                return null;
            }
        }
        catch (Exception)
        {
            return null;
        }
        
        var licenseData = JsonSerializer.Deserialize<LicenseData>(Encoding.UTF8.GetString(Convert.FromBase64String(parts[1])), ReusableJsonSerializerOptions.Web)!;

        // check if license organization matches
        if (licenseData.OrgId != orgId)
        {
            return null;
        }
        
        // check issuer
        if (licenseData.Issuer != "https://www.featbit.co")
        {
            return null;
        }
        
        // check expiration
        if (DateTimeOffset.FromUnixTimeMilliseconds(licenseData.Exp) < DateTimeOffset.UtcNow)
        {
            return null;
        }

        return licenseData;
    }

    public async Task<LicenseData?> VerifyLicenseAsync(Guid orgId)
    {
        var licenseStr = await _cacheService.GetLicenseAsync(orgId);
        
        if (string.IsNullOrEmpty(licenseStr))
        {
            var org = await _organizationService.GetAsync(orgId);
            licenseStr = org.License;
        }

        return VerifyLicenseAsync(orgId, licenseStr);
    }
}