using Domain.Utils;

namespace Domain.UnitTests.Utils;

public class StringExtensionsTests
{
    [Theory]
    [InlineData("hello world", new[] { ' ' }, '-', "hello-world")]
    [InlineData("a/b\\c", new[] { '/', '\\' }, '_', "a_b_c")]
    [InlineData("nothing-to-replace", new[] { 'z' }, '!', "nothing-to-replace")]
    [InlineData("", new[] { 'a', 'b' }, 'x', "")]
    public void Replace_MultipleChars_ReplacesEachOccurrenceWithReplacement(
        string input, char[] chars, char replacement, string expected)
    {
        var actual = input.Replace(chars, replacement);

        Assert.Equal(expected, actual);
    }
}
