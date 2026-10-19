using Application.Bases;
using Application.Identity;

namespace Application.UnitTests.Validators;

public class IdentityValidatorTests
{
    [Theory]
    [InlineData("", "pwd", "email")]
    [InlineData("not-an-email", "pwd", "email")]
    [InlineData("a@b.co", "", "password")]
    public void LoginByEmail_InvalidInputs_RegistersExpectedError(string email, string password, string fieldHint)
    {
        var result = new LoginByEmailValidator().Validate(new LoginByEmail { Email = email, Password = password });

        Assert.Contains(
            result.Errors,
            e => e.ErrorCode == ErrorCodes.Required(fieldHint) || e.ErrorCode == ErrorCodes.Invalid(fieldHint));
    }

    [Fact]
    public void LoginByEmail_Valid_NoErrors()
    {
        var result = new LoginByEmailValidator().Validate(new LoginByEmail { Email = "a@b.co", Password = "pwd" });

        Assert.True(result.IsValid);
    }

    [Fact]
    public void ResetPassword_ShortPassword_TooShortError()
    {
        var result = new ResetPasswordValidator().Validate(new ResetPassword { CurrentPassword = "x", NewPassword = "abc" });

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.PasswordTooShort);
    }

    [Fact]
    public void ResetPassword_LongEnoughPassword_NoErrors()
    {
        var result = new ResetPasswordValidator().Validate(new ResetPassword { NewPassword = "abcdef" });

        Assert.True(result.IsValid);
    }
}
