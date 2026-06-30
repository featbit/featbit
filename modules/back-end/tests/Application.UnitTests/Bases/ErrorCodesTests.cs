using Application.Bases;

namespace Application.UnitTests.Bases;

public class ErrorCodesTests
{
    [Theory]
    [InlineData("name", "name_is_required")]
    [InlineData("email", "email_is_required")]
    [InlineData("", "_is_required")]
    public void Required_AnyParameterName_ReturnsExpectedTemplate(string parameter, string expected)
    {
        Assert.Equal(expected, ErrorCodes.Required(parameter));
    }

    [Theory]
    [InlineData("type", "type_is_invalid")]
    [InlineData("key", "key_is_invalid")]
    public void Invalid_AnyParameterName_ReturnsExpectedTemplate(string parameter, string expected)
    {
        Assert.Equal(expected, ErrorCodes.Invalid(parameter));
    }

    [Fact]
    public void Constants_MatchTheirOwnNames()
    {
        Assert.Equal("Unauthorized", ErrorCodes.Unauthorized);
        Assert.Equal("Forbidden", ErrorCodes.Forbidden);
        Assert.Equal("ResourceNotFound", ErrorCodes.ResourceNotFound);
        Assert.Equal("NameHasBeenUsed", ErrorCodes.NameHasBeenUsed);
        Assert.Equal("KeyHasBeenUsed", ErrorCodes.KeyHasBeenUsed);
        Assert.Equal("InternalServerError", ErrorCodes.InternalServerError);
        Assert.Equal("PasswordTooShort", ErrorCodes.PasswordTooShort);
    }
}
