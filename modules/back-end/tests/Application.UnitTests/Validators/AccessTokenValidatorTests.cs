using Application.AccessTokens;
using Application.Bases;
using Domain.AccessTokens;
using Domain.Policies;

namespace Application.UnitTests.Validators;

public class AccessTokenValidatorTests
{
    [Fact]
    public void Create_NameAndDefinedType_NoErrors()
    {
        var request = new CreateAccessToken
        {
            Name = "tok",
            Type = AccessTokenTypes.All.First(),
            Permissions = Array.Empty<PolicyStatement>()
        };

        var result = new CreateAccessTokenValidator().Validate(request);

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Create_EmptyName_NameRequiredError()
    {
        var request = new CreateAccessToken
        {
            Name = string.Empty,
            Type = AccessTokenTypes.All.First()
        };

        var result = new CreateAccessTokenValidator().Validate(request);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Required("name"));
    }

    [Fact]
    public void Create_UndefinedType_TypeInvalidError()
    {
        var request = new CreateAccessToken
        {
            Name = "tok",
            Type = "not-a-real-type"
        };

        var result = new CreateAccessTokenValidator().Validate(request);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("type"));
    }

    [Fact]
    public void Update_NameProvided_NoErrors()
    {
        var result = new UpdateAccessTokenValidator().Validate(new UpdateAccessToken { Name = "n" });

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Update_EmptyName_NameRequiredError()
    {
        var result = new UpdateAccessTokenValidator().Validate(new UpdateAccessToken { Name = string.Empty });

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Required("name"));
    }
}
