using Application.Bases;
using Application.Groups;
using Application.Identity;
using Application.Members;
using Application.Organizations;
using Application.Policies;
using Application.Projects;
using Application.Resources;
using Application.Triggers;
using Application.Users;
using Domain.Organizations;
using Domain.Triggers;

namespace Application.UnitTests.Validators;

public class MiscValidatorTests
{
    [Fact]
    public void CreateGroup_EmptyName_NameRequiredError()
    {
        var result = new CreateGroupValidator().Validate(new CreateGroup { Name = string.Empty });

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Required("name"));
    }

    [Fact]
    public void UpdateGroup_NameProvided_NoErrors()
    {
        var result = new UpdateGroupValidator().Validate(new UpdateGroup { Name = "g" });

        Assert.True(result.IsValid);
    }

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

    [Fact]
    public void AddMember_EmptyEmail_EmailRequiredError()
    {
        var result = new AddMemberValidator().Validate(new AddMember { Email = string.Empty });

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Required("email"));
    }

    [Fact]
    public void AddMember_BadEmail_EmailInvalidError()
    {
        var result = new AddMemberValidator().Validate(new AddMember { Email = "not-an-email" });

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("email"));
    }

    [Theory]
    [InlineData("", "k", "name")]
    [InlineData("n", "", "key")]
    public void CreateOrganization_MissingRequired_Error(string name, string key, string field)
    {
        var result = new CreateOrganizationValidator().Validate(new CreateOrganization { Name = name, Key = key });

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Required(field));
    }

    [Fact]
    public void UpdateOrganization_NullSettings_SettingsRequiredError()
    {
        var request = new UpdateOrganization
        {
            Name = "n",
            DefaultPermissions = new OrganizationPermissions(),
            Settings = null
        };

        var result = new UpdateOrganizationValidator().Validate(request);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Required("settings"));
    }

    [Fact]
    public void UpdateOrganization_EmptyPermissions_InvalidError()
    {
        var request = new UpdateOrganization
        {
            Name = "n",
            DefaultPermissions = new OrganizationPermissions { PolicyIds = new List<Guid>(), GroupIds = new List<Guid>() },
            Settings = new OrganizationSetting()
        };

        var result = new UpdateOrganizationValidator().Validate(request);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("defaultPermissions"));
    }

    [Fact]
    public void Onboarding_AllFieldsValid_NoErrors()
    {
        var request = new Onboarding
        {
            OrganizationName = "org",
            OrganizationKey = "key",
            ProjectName = "proj",
            ProjectKey = "pk",
            Environments = new[] { "Dev" }
        };

        var result = new OnboardingValidator().Validate(request);

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Onboarding_EmptyEnvironments_EnvironmentsRequiredError()
    {
        var request = new Onboarding
        {
            OrganizationName = "org",
            OrganizationKey = "key",
            ProjectName = "proj",
            ProjectKey = "pk",
            Environments = Array.Empty<string>()
        };

        var result = new OnboardingValidator().Validate(request);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Required("environments"));
    }

    [Theory]
    [InlineData("", "k", "name")]
    [InlineData("n", "", "key")]
    public void CreatePolicy_MissingRequired_Error(string name, string key, string field)
    {
        var result = new CreatePolicyValidator().Validate(new CreatePolicy { Name = name, Key = key });

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Required(field));
    }

    [Fact]
    public void ClonePolicy_InvalidOriginType_OriginPolicyTypeInvalidError()
    {
        var result = new ClonePolicyValidator().Validate(new ClonePolicy
        {
            Name = "n",
            Key = "k",
            OriginPolicyType = "weird"
        });

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("originPolicyType"));
    }

    [Fact]
    public void UpdatePolicySetting_EmptyName_NameRequiredError()
    {
        var result = new UpdatePolicySettingValidator().Validate(new UpdatePolicySetting { Name = string.Empty });

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Required("name"));
    }

    [Theory]
    [InlineData("", "k", "name")]
    [InlineData("n", "", "key")]
    public void CreateProject_MissingRequired_Error(string name, string key, string field)
    {
        var result = new CreateProjectValidator().Validate(new CreateProject { Name = name, Key = key });

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Required(field));
    }

    [Fact]
    public void UpdateProject_EmptyName_NameRequiredError()
    {
        var result = new UpdateProjectValidator().Validate(new UpdateProject { Name = string.Empty });

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Required("name"));
    }

    [Fact]
    public void GetResourceListV2_EmptySpaceId_SpaceIdRequiredError()
    {
        var request = new GetResourceListV2
        {
            SpaceId = Guid.Empty,
            Filter = new ResourceFilterV2 { SpaceLevel = ResourceSpaceLevel.Workspace }
        };

        var result = new GetResourceListV2Validator().Validate(request);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Required("spaceId"));
    }

    [Fact]
    public void GetResourceListV2_UndefinedSpaceLevel_FilterInvalidError()
    {
        var request = new GetResourceListV2
        {
            SpaceId = Guid.NewGuid(),
            Filter = new ResourceFilterV2 { SpaceLevel = "galaxy" }
        };

        var result = new GetResourceListV2Validator().Validate(request);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("filter.spaceLevel"));
    }

    [Fact]
    public void CreateTrigger_UndefinedTypeAndAction_BothInvalidErrors()
    {
        var result = new CreateTriggerValidator().Validate(new CreateTrigger { Type = "x", Action = "y" });

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("type"));
        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("action"));
    }

    [Fact]
    public void CreateTrigger_ValidTypeAndAction_NoErrors()
    {
        var result = new CreateTriggerValidator().Validate(new CreateTrigger
        {
            Type = TriggerTypes.FfGeneral,
            Action = TriggerActions.TurnOn
        });

        Assert.True(result.IsValid);
    }

    [Theory]
    [InlineData("", "email")]
    [InlineData("not-an-email", "email")]
    public void UpdateProfile_BadEmail_Error(string email, string field)
    {
        var result = new UpdateProfileValidator().Validate(new UpdateProfile { Email = email });

        Assert.Contains(
            result.Errors,
            e => e.ErrorCode == ErrorCodes.Required(field) || e.ErrorCode == ErrorCodes.Invalid(field));
    }
}
