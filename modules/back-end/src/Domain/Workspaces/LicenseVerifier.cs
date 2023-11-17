using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Domain.Workspaces;

public static class LicenseVerifier
{
    private static bool _isInitialized;
    private static readonly RSA Rsa = RSA.Create();

    public static void ImportPublicKey(string key)
    {
        Rsa.ImportFromPem(key);
        _isInitialized = true;
    }

    public static bool TryParse(Guid workspaceId, string licenseString, out License license)
    {
        EnsureInitialized();

        license = new License();
        if (string.IsNullOrEmpty(licenseString))
        {
            return false;
        }

        var parts = licenseString.Split('.');
        if (parts.Length != 2)
        {
            return false;
        }

        var signature = parts[0];
        var payload = parts[1];

        try
        {
            var isValid = Rsa.VerifyData(
                Encoding.UTF8.GetBytes(payload),
                Convert.FromBase64String(signature),
                HashAlgorithmName.SHA256,
                RSASignaturePadding.Pkcs1
            );

            if (!isValid)
            {
                return false;
            }
        }
        catch (Exception)
        {
            return false;
        }

        license = JsonSerializer.Deserialize<License>(
            Convert.FromBase64String(payload),
            ReusableJsonSerializerOptions.Web
        )!;
        return license.IsValid(workspaceId);
    }

    private static void EnsureInitialized()
    {
        if (!_isInitialized)
        {
            throw new InvalidOperationException("LicenseVerifier is not initialized");
        }
    }
}