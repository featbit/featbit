using Application.Bases;
using Application.FeatureFlags;
using FluentValidation.Results;

namespace Application.UnitTests.Validators;

public class FlagCopyValidatorTests
{
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
