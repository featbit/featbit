using Streaming.Shared;

namespace Streaming.UnitTests.Shared;

public class SecretTests
{
    [Theory]
    [ClassData(typeof(ValidSecrets))]
    public void ParseValidSecret(string secretString, Guid envId)
    {
        var isValid = Secret.TryParse(secretString, out var secret);

        Assert.True(isValid);
        Assert.Equal(envId, secret.EnvId);
    }

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    [InlineData(" ")]
    [InlineData("random-string")]
    [InlineData("ZGY1LTUxYTQtNCUyMDIyMDkwNTAwNTQxOV9fNDZfXzkzX18tMV9fZGVmYXVsdF82MjdhMg==")]
    [InlineData("aGVsbG8gd29ybGQ=")]
    public void ParseInvalidSecret(string secretString)
    {
        var isValid = Secret.TryParse(secretString, out var secret);

        Assert.False(isValid);
        Assert.Equal(Guid.Empty, secret.EnvId);
    }
}

public class ValidSecrets : TheoryData<string, Guid>
{
    public ValidSecrets()
    {
        Add(TestData.DevSecretString, TestData.DevEnvId);
        Add(TestData.ProdSecretString, TestData.ProdEnvId);
    }
}