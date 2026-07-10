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
    public void EscapeRegex_StringWithSpecialChars_EscapesEachSpecialChar(string input, string expected)
    {
        string actual = StringHelper.EscapeRegex(input);
        Assert.Equal(expected, actual);
    }
}