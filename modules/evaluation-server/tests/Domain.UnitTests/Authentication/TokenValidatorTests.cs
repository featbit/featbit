using Domain.Shared;
using Domain.Shared.Authentication;

namespace Domain.UnitTests.Authentication;

public class TokenValidatorTests
{
    private readonly TokenValidator _validator = new();

    [Fact]
    public async Task ValidateAsync_WithValidSecret_ReturnsValid()
    {
        // Arrange
        var secret = TestData.ServerSecretString;

        // Act
        var result = await _validator.ValidateAsync(secret);

        // Assert
        Assert.Equal(TokenValidationStatus.Valid, result.Status);
        Assert.Equal(TestData.ServerEnvId, result.EnvId);
        Assert.Empty(result.Reason);
    }

    [Fact]
    public async Task ValidateAsync_WithMalformedSecret_ReturnsInvalid()
    {
        // Arrange
        var malformed = "invalid-secret-string";

        // Act
        var result = await _validator.ValidateAsync(malformed);

        // Assert
        Assert.Equal(TokenValidationStatus.Invalid, result.Status);
        Assert.Equal(Guid.Empty, result.EnvId);
        Assert.NotEmpty(result.Reason);
    }

    [Fact]
    public async Task ValidateAsync_WithEmptyCredential_ReturnsInvalid()
    {
        // Act
        var result = await _validator.ValidateAsync(string.Empty);

        // Assert
        Assert.Equal(TokenValidationStatus.Invalid, result.Status);
        Assert.NotEmpty(result.Reason);
    }

    [Fact]
    public async Task ValidateAsync_WithNullCredential_ReturnsInvalid()
    {
        // Act
        var result = await _validator.ValidateAsync(null);

        // Assert
        Assert.Equal(TokenValidationStatus.Invalid, result.Status);
        Assert.NotEmpty(result.Reason);
    }

    [Fact]
    public async Task ValidateAsync_WithWhitespaceCredential_ReturnsInvalid()
    {
        // Act
        var result = await _validator.ValidateAsync("   ");

        // Assert
        Assert.Equal(TokenValidationStatus.Invalid, result.Status);
    }

    [Fact]
    public async Task ValidateAsync_ExtractsCorrectEnvIdForClientSecret()
    {
        // Act
        var result = await _validator.ValidateAsync(TestData.ClientSecretString);

        // Assert
        Assert.Equal(TokenValidationStatus.Valid, result.Status);
        Assert.Equal(TestData.ClientEnvId, result.EnvId);
    }
}
