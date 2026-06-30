using Application.Bases;
using Application.Environments;
using Domain.Environments;

namespace Application.UnitTests.Validators;

public class EnvironmentValidatorTests
{
    [Fact]
    public void CreateEnvironment_AllFieldsValid_NoErrors()
    {
        var request = new CreateEnvironment { Name = "Prod", Key = "prod" };

        var result = new CreateEnvironmentValidator().Validate(request);

        Assert.True(result.IsValid);
    }

    [Theory]
    [InlineData("", "prod", "name")]
    [InlineData("Prod", "", "key")]
    public void CreateEnvironment_EmptyField_RequiredError(string name, string key, string field)
    {
        var request = new CreateEnvironment { Name = name, Key = key };

        var result = new CreateEnvironmentValidator().Validate(request);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Required(field));
    }

    [Fact]
    public void UpdateEnvironment_EmptyName_NameRequiredError()
    {
        var result = new UpdateEnvironmentValidator().Validate(new UpdateEnvironment { Name = string.Empty });

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Required("name"));
    }

    [Fact]
    public void AddSecret_NameAndDefinedType_NoErrors()
    {
        var result = new AddSecretValidator().Validate(new AddSecret { Name = "n", Type = SecretTypes.All.First() });

        Assert.True(result.IsValid);
    }

    [Fact]
    public void AddSecret_EmptyName_NameRequiredError()
    {
        var result = new AddSecretValidator().Validate(new AddSecret { Name = string.Empty, Type = SecretTypes.All.First() });

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Required("name"));
    }

    [Fact]
    public void AddSecret_UndefinedType_TypeInvalidError()
    {
        var result = new AddSecretValidator().Validate(new AddSecret { Name = "n", Type = "unknown" });

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("type"));
    }

    [Fact]
    public void UpdateSecret_EmptyName_NameRequiredError()
    {
        var result = new UpdateSecretValidator().Validate(new UpdateSecret { Name = string.Empty });

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Required("name"));
    }
}
