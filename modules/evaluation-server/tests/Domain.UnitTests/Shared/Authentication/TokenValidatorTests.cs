using Domain.Shared;
using Domain.Shared.Authentication;

namespace Domain.UnitTests.Shared.Authentication;

public class TokenValidatorTests
{
    private readonly TokenValidator _validator = new();

    [Fact]
    public async Task ValidateAsync_WithValidSecret_ReturnsValid()
    {
        var secret = TestData.ServerSecretString;

        var result = await _validator.ValidateAsync(secret);

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
        var result = await _validator.ValidateAsync(secret);

        Assert.Equal(TokenValidationStatus.Invalid, result.Status);
        Assert.Equal(Guid.Empty, result.EnvId);

        Assert.NotEmpty(result.Reason);
    }

    [Fact]
    public async Task ValidateAsync_ClientSecret_ExtractsCorrectEnvId()
    {
        var result = await _validator.ValidateAsync(TestData.ClientSecretString);

        Assert.Equal(TokenValidationStatus.Valid, result.Status);
        Assert.Equal(TestData.ClientEnvId, result.EnvId);
    }
}
