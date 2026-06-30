using Application.Bases;
using Application.EndUsers;
using Domain.EndUsers;

namespace Application.UnitTests.Validators;

public class EndUserValidatorTests
{
    [Fact]
    public void UpsertEndUser_KeyIdAndName_NoErrors()
    {
        var result = new UpsertEndUserValidator().Validate(new UpsertEndUser { KeyId = "k", Name = "n" });

        Assert.True(result.IsValid);
    }

    [Theory]
    [InlineData("", "n", "keyId")]
    [InlineData("k", "", "name")]
    public void UpsertEndUser_MissingRequiredField_RequiredError(string keyId, string name, string field)
    {
        var result = new UpsertEndUserValidator().Validate(new UpsertEndUser { KeyId = keyId, Name = name });

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Required(field));
    }

    [Fact]
    public void UpsertEndUserProperty_NameProvided_NoErrors()
    {
        var result = new UpsertEndUserPropertyValidator().Validate(new UpsertEndUserProperty { Name = "n" });

        Assert.True(result.IsValid);
    }

    [Fact]
    public void UpsertEndUserProperty_EmptyName_NameRequiredError()
    {
        var result = new UpsertEndUserPropertyValidator().Validate(new UpsertEndUserProperty { Name = string.Empty });

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Required("name"));
    }

    [Fact]
    public void GetFeatureFlagEndUserList_AllFieldsValid_NoErrors()
    {
        var request = new GetFeatureFlagEndUserList
        {
            EnvId = Guid.NewGuid(),
            Filter = new FeatureFlagEndUserFilter { FeatureFlagKey = "k", From = 1, To = 2 }
        };

        var result = new GetFeatureFlagEndUserListValidator().Validate(request);

        Assert.True(result.IsValid);
    }

    [Fact]
    public void GetFeatureFlagEndUserList_EmptyKey_FeatureFlagKeyRequiredError()
    {
        var request = new GetFeatureFlagEndUserList
        {
            Filter = new FeatureFlagEndUserFilter { FeatureFlagKey = string.Empty, From = 1, To = 2 }
        };

        var result = new GetFeatureFlagEndUserListValidator().Validate(request);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Required("featureFlagKey"));
    }

    [Fact]
    public void GetFeatureFlagEndUserList_FromOrToZero_RangeInvalidErrors()
    {
        var request = new GetFeatureFlagEndUserList
        {
            Filter = new FeatureFlagEndUserFilter { FeatureFlagKey = "k", From = 0, To = 0 }
        };

        var result = new GetFeatureFlagEndUserListValidator().Validate(request);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("from"));
        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("to"));
    }
}
