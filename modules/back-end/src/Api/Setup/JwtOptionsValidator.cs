using System.Security.Cryptography;
using Infrastructure.Identity;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Api.Setup;

/// <summary>
/// Validates <see cref="JwtOptions"/> at application startup via <see cref="IValidateOptions{TOptions}"/>.
/// </summary>
internal sealed class JwtOptionsValidator : IValidateOptions<JwtOptions>
{
    public ValidateOptionsResult Validate(string? name, JwtOptions options)
    {
        var errors = new List<string>();

        string[] supportedAlgorithms =
        [
            SecurityAlgorithms.HmacSha256,
            SecurityAlgorithms.RsaSha256,
            SecurityAlgorithms.EcdsaSha256
        ];
        if (!supportedAlgorithms.Contains(options.Algorithm))
        {
            errors.Add(
                $"Unsupported Jwt Algorithm: {options.Algorithm}. " +
                $"Supported algorithms: {string.Join(", ", supportedAlgorithms)}."
            );
        }

        switch (options.Algorithm)
        {
            case SecurityAlgorithms.HmacSha256:
                var key = options.Key;

                if (string.IsNullOrWhiteSpace(key))
                {
                    errors.Add("Jwt__Key is required when Algorithm is 'HS256'.");
                }
                else if (key.Length < 32)
                {
                    errors.Add("Jwt__Key must be at least 32 characters long for HS256 to ensure security.");
                }

                break;

            case SecurityAlgorithms.RsaSha256:
            case SecurityAlgorithms.EcdsaSha256:
                var privateKeyPath = options.PrivateKeyPath;
                if (string.IsNullOrWhiteSpace(privateKeyPath))
                {
                    errors.Add($"Jwt__PrivateKeyPath is required when Algorithm is '{options.Algorithm}'.");
                }
                else if (!File.Exists(privateKeyPath))
                {
                    errors.Add($"Jwt__PrivateKeyPath file not found: {privateKeyPath}");
                }
                else if (!TryLoadSecurityKey(options.Algorithm, privateKeyPath, out var errorMessage))
                {
                    errors.Add(
                        $"Failed to load private key for algorithm '{options.Algorithm}' from: {privateKeyPath}. Error: {errorMessage}"
                    );
                }

                var publicKeyPath = options.PublicKeyPath;
                if (string.IsNullOrWhiteSpace(publicKeyPath))
                {
                    errors.Add($"Jwt__PublicKeyPath is required when Algorithm is '{options.Algorithm}'.");
                }
                else if (!File.Exists(publicKeyPath))
                {
                    errors.Add($"Jwt__PublicKeyPath file not found: {publicKeyPath}");
                }
                else if (!TryLoadSecurityKey(options.Algorithm, publicKeyPath, out var errorMessage))
                {
                    errors.Add(
                        $"Failed to load public key for algorithm '{options.Algorithm}' from: {publicKeyPath}. Error: {errorMessage}"
                    );
                }

                break;
        }

        return errors.Count > 0
            ? ValidateOptionsResult.Fail(errors)
            : ValidateOptionsResult.Success;
    }

    private static bool TryLoadSecurityKey(string algorithm, string keyPath, out string errorMessage)
    {
        try
        {
            switch (algorithm)
            {
                case SecurityAlgorithms.RsaSha256:
                {
                    using var rsa = RSA.Create();
                    rsa.ImportFromPem(File.ReadAllText(keyPath));
                    _ = new RsaSecurityKey(rsa);
                    break;
                }

                case SecurityAlgorithms.EcdsaSha256:
                {
                    using var ecdsa = ECDsa.Create();
                    ecdsa.ImportFromPem(File.ReadAllText(keyPath));
                    _ = new ECDsaSecurityKey(ecdsa);
                    break;
                }
            }

            errorMessage = string.Empty;
            return true;
        }
        catch (Exception ex)
        {
            errorMessage = ex.Message;
            return false;
        }
    }
}