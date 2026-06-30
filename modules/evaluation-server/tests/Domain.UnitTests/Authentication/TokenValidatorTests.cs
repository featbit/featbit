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

    [Theory]
    [InlineData("invalid-secret-string")]
    [InlineData("")]
    [InlineData(null)]
    [InlineData("   ")]
    public async Task ValidateAsync_WithInvalidSecret_ReturnsInvalid(string? secret)
    {
        // Act
        var result = await _validator.ValidateAsync(secret);

        // Assert
        Assert.Equal(TokenValidationStatus.Invalid, result.Status);
        Assert.Equal(Guid.Empty, result.EnvId);

        Assert.NotEmpty(result.Reason);
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
