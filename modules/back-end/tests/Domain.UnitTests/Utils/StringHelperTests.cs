using Domain.Utils;

namespace Domain.UnitTests.Utils;

public class StringHelperTests
{
    [Theory]
    [InlineData(@"My password is not (*)!/\?", @"My password is not \(\*\)\!\/\\\?")]
    [InlineData("", "")]
    [InlineData("hello.world", @"hello\.world")]
    [InlineData("hello*world", @"hello\*world")]
    [InlineData(@"\\\\\\\\", @"\\\\\\\\\\\\\\\\")]
    [InlineData(@"!..{?***?/\\?*^+=:$$}", @"\!\.\.\{\?\*\*\*\?\/\\\\\?\*\^\+\=\:\$\$\}")]
    public void TestEscapeRegex(string input, string expected)
    {
        string actual = StringHelper.EscapeRegex(input);
        Assert.Equal(actual, expected);
    }
}

