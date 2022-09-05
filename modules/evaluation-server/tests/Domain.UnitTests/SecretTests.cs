namespace Domain.UnitTests;

public class SecretTests
{
    [Theory]
    [InlineData("ZWM4LTNhZDUtNCUyMDIyMDkwNTAwMjMyNF9fNDZfXzkzX181N19fbW9iaWxlXzU3Mzlh", 46, 93, 57)]
    [InlineData("YmYzLWViZDYtNCUyMDIyMDkwNTAwMjMyNF9fNDZfXzkzX181N19fZGVmYXVsdF9jMDllZg==", 46, 93, 57)]
    [InlineData("MGY0LTUxYTItNCUyMDIyMDkwNTAwNTEzMF9fOTRfXzExMV9fNDI4X19kZWZhdWx0X2RiOTFh", 94, 111, 428)]
    public void Should_Parse_Valid_Secret(string secretString, int accountId, int projectId, int envId)
    {
        var isValid = Secret.TryParse(secretString, out var secret);

        Assert.True(isValid);
        Assert.Equal(accountId, secret.AccountId);
        Assert.Equal(projectId, secret.ProjectId);
        Assert.Equal(envId, secret.EnvId);
    }

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    [InlineData(" ")]
    [InlineData("random-string")]
    [InlineData("ZGY1LTUxYTQtNCUyMDIyMDkwNTAwNTQxOV9fNDZfXzkzX18tMV9fZGVmYXVsdF82MjdhMg==")]
    [InlineData("aGVsbG8gd29ybGQ=")]
    public void Should_Parse_Invalid_Secret(string secretString)
    {
        var isValid = Secret.TryParse(secretString, out var secret);

        Assert.False(isValid);
        Assert.Equal(0, secret.AccountId);
        Assert.Equal(0, secret.ProjectId);
        Assert.Equal(0, secret.EnvId);
    }
}