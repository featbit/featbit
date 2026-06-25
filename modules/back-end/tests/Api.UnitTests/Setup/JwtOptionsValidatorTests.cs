using Api.Setup;
using Infrastructure.Identity;
using Microsoft.IdentityModel.Tokens;

namespace Api.UnitTests.Setup;

public class JwtOptionsValidatorTests
{
    private const string DefaultHs256Key = "featbit-identity-key-must-longer-than-32-characters";

    private static JwtOptions Hs256(string? key)
    {
        return new JwtOptions
        {
            Algorithm = SecurityAlgorithms.HmacSha256,
            Key = key ?? string.Empty
        };
    }

    [Fact]
    public void Validate_SupportedAlgorithmAndStrongHs256Key_Succeeds()
    {
        var sut = new JwtOptionsValidator();

        var result = sut.Validate(name: null, Hs256("ThisKeyIsLongEnoughAndNotTheDefault!!"));

        Assert.True(result.Succeeded);
    }

    [Fact]
    public void Validate_UnsupportedAlgorithm_FailsWithDescriptiveError()
    {
        var sut = new JwtOptionsValidator();

        var result = sut.Validate(null, new JwtOptions { Algorithm = "HS512" });

        Assert.True(result.Failed);
        Assert.Contains(result.Failures, m => m.Contains("Unsupported Jwt Algorithm"));
    }

    [Fact]
    public void Validate_Hs256_MissingKey_FailsWithKeyRequiredError()
    {
        var sut = new JwtOptionsValidator();

        var result = sut.Validate(null, Hs256(string.Empty));

        Assert.True(result.Failed);
        Assert.Contains(result.Failures, m => m.Contains("Jwt__Key is required"));
    }

    [Fact]
    public void Validate_Hs256_UsesDefaultPublicKey_FailsAsInsecure()
    {
        var sut = new JwtOptionsValidator();

        var result = sut.Validate(null, Hs256(DefaultHs256Key));

        Assert.True(result.Failed);
        Assert.Contains(result.Failures, m => m.Contains("default public value"));
    }

    [Fact]
    public void Validate_Hs256_KeyShorterThan32Characters_FailsWithLengthError()
    {
        var sut = new JwtOptionsValidator();

        var result = sut.Validate(null, Hs256(new string('a', 31)));

        Assert.True(result.Failed);
        Assert.Contains(result.Failures, m => m.Contains("at least 32 characters"));
    }

    [Fact]
    public void Validate_Rs256_MissingPrivateAndPublicKeyPaths_FailsForBoth()
    {
        var sut = new JwtOptionsValidator();

        var result = sut.Validate(null, new JwtOptions { Algorithm = SecurityAlgorithms.RsaSha256 });

        Assert.True(result.Failed);
        Assert.Contains(result.Failures, m => m.Contains("Jwt__PrivateKeyPath is required"));
        Assert.Contains(result.Failures, m => m.Contains("Jwt__PublicKeyPath is required"));
    }

    [Fact]
    public void Validate_Rs256_PrivateAndPublicKeyPathDoNotExist_FailsWithFileNotFoundErrors()
    {
        var sut = new JwtOptionsValidator();
        var missing = Path.Combine(Path.GetTempPath(), $"missing-{Guid.NewGuid():N}.pem");

        var result = sut.Validate(null, new JwtOptions
        {
            Algorithm = SecurityAlgorithms.RsaSha256,
            PrivateKeyPath = missing,
            PublicKeyPath = missing
        });

        Assert.True(result.Failed);
        Assert.Contains(result.Failures, m => m.Contains("PrivateKeyPath file not found"));
        Assert.Contains(result.Failures, m => m.Contains("PublicKeyPath file not found"));
    }

    [Fact]
    public void Validate_Rs256_KeyFileExistsButIsNotPem_FailsWithLoadError()
    {
        var sut = new JwtOptionsValidator();
        var garbage = Path.Combine(Path.GetTempPath(), $"garbage-{Guid.NewGuid():N}.pem");
        File.WriteAllText(garbage, "not a real PEM file");

        try
        {
            var result = sut.Validate(null, new JwtOptions
            {
                Algorithm = SecurityAlgorithms.RsaSha256,
                PrivateKeyPath = garbage,
                PublicKeyPath = garbage
            });

            Assert.True(result.Failed);
            Assert.Contains(result.Failures, m => m.Contains("Failed to load private key"));
            Assert.Contains(result.Failures, m => m.Contains("Failed to load public key"));
        }
        finally
        {
            File.Delete(garbage);
        }
    }
}
