using Application.Bases;
using Application.FeatureFlags;
using FluentValidation.Results;
using Domain.FeatureFlags;
using System.Text.Json;

namespace Application.UnitTests.Validators;

public class FlagCopyValidatorTests
{
    [Theory]
    [InlineData("{}", "Options.IndividualTargeting", "Options.TargetingRule")]
    [InlineData("{\"individualTargeting\":null,\"targetingRule\":{\"copy\":false}}", "Options.IndividualTargeting", null)]
    [InlineData("{\"individualTargeting\":{\"copy\":false},\"targetingRule\":null}", "Options.TargetingRule", null)]
    [InlineData("{\"targetingRule\":{\"copy\":false}}", "Options.IndividualTargeting", null)]
    [InlineData("{\"individualTargeting\":{\"copy\":false}}", "Options.TargetingRule", null)]
    public void Validate_MissingNestedOptions_ReturnsFieldErrors(string json, string field, string? secondField)
    {
        var options = JsonSerializer.Deserialize<FlagSettingCopyOptions>(json, JsonSerializerOptions.Web)!;
        var request = NewSettingsRequest(options);

        var result = new CopyFlagSettingsValidator().Validate(request);

        var fields = secondField == null ? new[] { field } : new[] { field, secondField };
        Assert.Equal(fields, result.Errors.Select(error => error.PropertyName));
        Assert.All(result.Errors, error => Assert.Equal(
            ErrorCodes.Invalid(error.PropertyName == "Options.IndividualTargeting"
                ? "options.individualTargeting" : "options.targetingRule"), error.ErrorCode));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData("unknown")]
    [InlineData("OVERWRITE")]
    public void Validate_EnabledCopyWithInvalidMode_ReturnsFieldErrors(string? mode)
    {
        var request = NewSettingsRequest(new(false, new(true, mode!), new(true, mode!), false, false));

        var result = new CopyFlagSettingsValidator().Validate(request);

        Assert.Collection(result.Errors,
            error =>
            {
                Assert.Equal("Options.IndividualTargeting.Mode", error.PropertyName);
                Assert.Equal(ErrorCodes.Invalid("options.individualTargeting.mode"), error.ErrorCode);
            },
            error =>
            {
                Assert.Equal("Options.TargetingRule.Mode", error.PropertyName);
                Assert.Equal(ErrorCodes.Invalid("options.targetingRule.mode"), error.ErrorCode);
            });
    }

    [Theory]
    [InlineData(true, CopyModes.Overwrite, CopyModes.Append)]
    [InlineData(true, CopyModes.Append, CopyModes.Overwrite)]
    [InlineData(false, null, null)]
    [InlineData(false, "", "unknown")]
    public void Validate_ValidOrDisabledCopyModes_AcceptsRequest(bool copy, string? individualMode, string? ruleMode)
    {
        var request = NewSettingsRequest(new(false, new(copy, individualMode!), new(copy, ruleMode!), false, false));

        var result = new CopyFlagSettingsValidator().Validate(request);

        Assert.True(result.IsValid);
    }

    private static CopyFlagSettings NewSettingsRequest(FlagSettingCopyOptions options) => new()
    {
        SourceEnvId = Guid.NewGuid(), TargetEnvId = Guid.NewGuid(), Key = "flag", Options = options
    };

    [Theory]
    [InlineData("copy", "null-ids", "FlagIds")]
    [InlineData("preview", "null-ids", "FlagIds")]
    [InlineData("copy", "empty-ids", "FlagIds")]
    [InlineData("preview", "empty-ids", "FlagIds")]
    [InlineData("copy", "source", "SourceEnvId")]
    [InlineData("preview", "source", "SourceEnvId")]
    [InlineData("settings", "source", "SourceEnvId")]
    [InlineData("copy", "target", "TargetEnvId")]
    [InlineData("preview", "target", "TargetEnvId")]
    [InlineData("settings", "target", "TargetEnvId")]
    [InlineData("copy", "same", "TargetEnvId")]
    [InlineData("preview", "same", "TargetEnvId")]
    [InlineData("settings", "same", "TargetEnvId")]
    [InlineData("settings", "null-key", "Key")]
    [InlineData("settings", "empty-key", "Key")]
    [InlineData("settings", "blank-key", "Key")]
    [InlineData("settings", "options", "Options")]
    public void InvalidInputHasFieldSpecificError(string operation, string invalid, string field)
    {
        var error = Assert.Single(Validate(operation, invalid).Errors);
        Assert.Equal(field, error.PropertyName);
        Assert.Equal(ErrorCodes.Invalid(char.ToLowerInvariant(field[0]) + field[1..]), error.ErrorCode);
    }

    [Theory]
    [InlineData("copy")]
    [InlineData("preview")]
    [InlineData("settings")]
    public void ValidRequestIsAccepted(string operation) => Assert.True(Validate(operation, "").IsValid);

    private static ValidationResult Validate(string operation, string invalid)
    {
        var source = invalid == "source" ? Guid.Empty : Guid.NewGuid();
        var target = invalid == "target" ? Guid.Empty : invalid == "same" ? source : Guid.NewGuid();
        ICollection<Guid> ids = invalid == "null-ids" ? null! : invalid == "empty-ids" ? [] : [Guid.NewGuid()];
        return operation switch
        {
            "copy" => new CopyToEnvValidator().Validate(new CopyToEnv() { SourceEnvId = source, TargetEnvId = target, FlagIds = ids }),
            "preview" => new CopyToEnvPrecheckValidator().Validate(new CopyToEnvPrecheck() { SourceEnvId = source, TargetEnvId = target, FlagIds = ids }),
            _ => new CopyFlagSettingsValidator().Validate(new CopyFlagSettings()
            {
                SourceEnvId = source, TargetEnvId = target,
                Key = invalid switch { "null-key" => null!, "empty-key" => "", "blank-key" => " \t", _ => "flag" },
                Options = invalid == "options" ? null! : new(false, new(false, "overwrite"), new(false, "overwrite"), false, false)
            })
        };
    }
}
