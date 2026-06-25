using Domain.Shared;

namespace Domain.UnitTests.Shared;

public class SecretTests
{
    [Theory]
    [ClassData(typeof(ValidSecrets))]
    public void TryParse_ValidSecretString_ReturnsTrueAndPopulatesEnvId(string secretString, Guid expected)
    {
        var isValid = Secret.TryParse(secretString, out var actual);

        Assert.True(isValid);
        Assert.Equal(expected, actual);
    }

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    [InlineData(" ")]
    [InlineData("random-string")]
    [InlineData("ZGY1LTUxYTQtNCUyMDIyMDkwNTAwNTQxOV9fNDZfXzkzX18tMV9fZGVmYXVsdF82MjdhMg==")]
    [InlineData("aGVsbG8gd29ybGQ=")]
    public void TryParse_InvalidSecretString_ReturnsFalseAndEmptyGuid(string? secretString)
    {
        var isValid = Secret.TryParse(secretString, out var actual);

        Assert.False(isValid);
        Assert.Equal(Guid.Empty, actual);
    }
}

public class ValidSecrets : TheoryData<string, Guid>
{
    public ValidSecrets()
    {
        Add(TestData.ClientSecretString, TestData.ClientEnvId);
        Add(TestData.ServerSecretString, TestData.ServerEnvId);
    }
}