using Domain.Users;

namespace Domain.UnitTests.Users;

public class PasswordGeneratorTests
{
    [Fact]
    public void New_ReturnsTwelveCharacterString()
    {
        var password = PasswordGenerator.New("user@example.com");

        Assert.Equal(12, password.Length);
    }

    [Fact]
    public void New_TwoSuccessiveCalls_ReturnDifferentValues()
    {
        var a = PasswordGenerator.New("same-key");
        var b = PasswordGenerator.New("same-key");

        Assert.NotEqual(a, b);
    }
}
