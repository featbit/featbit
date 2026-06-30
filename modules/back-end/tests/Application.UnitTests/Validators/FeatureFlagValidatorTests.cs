using Application.Bases;
using Application.FeatureFlags;
using Domain.FeatureFlags;

namespace Application.UnitTests.Validators;

public class FeatureFlagValidatorTests
{
    private static Variation V(string id = "v1") => new() { Id = id, Name = id.ToUpper(), Value = "val" };

    private static CreateFeatureFlag ValidCreate()
    {
        var on = V("v-on");
        var off = V("v-off");
        return new CreateFeatureFlag
        {
            Name = "Flag",
            Key = "flag.key-1",
            VariationType = VariationTypes.Boolean,
            Variations = new[] { on, off },
            EnabledVariationId = on.Id,
            DisabledVariationId = off.Id,
            Tags = Array.Empty<string>()
        };
    }

    [Fact]
    public void CreateFeatureFlag_AllFieldsValid_NoErrors()
    {
        var result = new CreateFeatureFlagValidator().Validate(ValidCreate());

        Assert.True(result.IsValid);
    }

    [Fact]
    public void CreateFeatureFlag_EmptyName_NameRequiredError()
    {
        var req = ValidCreate();
        req.Name = string.Empty;

        var result = new CreateFeatureFlagValidator().Validate(req);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Required("name"));
    }

    [Fact]
    public void CreateFeatureFlag_KeyWithIllegalChars_KeyInvalidError()
    {
        var req = ValidCreate();
        req.Key = "bad key!";

        var result = new CreateFeatureFlagValidator().Validate(req);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("key"));
    }

    [Fact]
    public void CreateFeatureFlag_UndefinedVariationType_VariationTypeInvalidError()
    {
        var req = ValidCreate();
        req.VariationType = "tristate";

        var result = new CreateFeatureFlagValidator().Validate(req);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("variationType"));
    }

    [Fact]
    public void CreateFeatureFlag_VariationWithMissingId_VariationsInvalidError()
    {
        var req = ValidCreate();
        req.Variations = new[] { new Variation { Id = "", Name = "x", Value = "y" } };
        req.EnabledVariationId = "x";
        req.DisabledVariationId = "x";

        var result = new CreateFeatureFlagValidator().Validate(req);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("variations"));
    }

    [Fact]
    public void CreateFeatureFlag_EnabledIdNotInVariations_EnabledVariationIdInvalidError()
    {
        var req = ValidCreate();
        req.EnabledVariationId = "missing";

        var result = new CreateFeatureFlagValidator().Validate(req);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("enabledVariationId"));
    }

    [Fact]
    public void UpdateName_LongerThan128_NameInvalidError()
    {
        var result = new UpdateNameValidator().Validate(new UpdateName { Name = new string('x', 129) });

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("name"));
    }

    [Fact]
    public void UpdateOffVariation_Empty_OffVariationIdRequiredError()
    {
        var result = new UpdateOffVariationValidator().Validate(new UpdateOffVariation { OffVariationId = string.Empty });

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Required("offVariationId"));
    }

    [Fact]
    public void UpdateVariations_NullValueOk_VariationsValid()
    {
        var req = new UpdateVariations { Variations = new[] { V("a") } };

        var result = new UpdateVariationsValidator().Validate(req);

        Assert.True(result.IsValid);
    }

    [Fact]
    public void UpdateVariations_OneInvalid_VariationsInvalidError()
    {
        var req = new UpdateVariations { Variations = new[] { V("a"), new Variation { Id = "" } } };

        var result = new UpdateVariationsValidator().Validate(req);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("variations"));
    }

    [Theory]
    [InlineData("", "src", "tgt", "key")]
    [InlineData("k", "", "tgt", "sourceEnvId")]
    [InlineData("k", "src", "", "targetEnvId")]
    public void CompareFlag_Missing_InvalidError(string key, string src, string tgt, string field)
    {
        var req = new CompareFlag
        {
            Key = key,
            SourceEnvId = string.IsNullOrEmpty(src) ? Guid.Empty : Guid.NewGuid(),
            TargetEnvId = string.IsNullOrEmpty(tgt) ? Guid.Empty : Guid.NewGuid()
        };

        var result = new CompareFlagValidator().Validate(req);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid(field));
    }

    [Fact]
    public void GetCompareFlagOverview_MissingTargets_TargetEnvIdsInvalidError()
    {
        var req = new GetCompareFlagOverview { SourceEnvId = Guid.NewGuid(), TargetEnvIds = Array.Empty<Guid>() };

        var result = new GetCompareFlagOverviewValidator().Validate(req);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("targetEnvIds"));
    }

    [Fact]
    public void CloneFlag_InvalidKeyChars_KeyInvalidError()
    {
        var req = new CloneFlag { Name = "n", Key = "bad key" };

        var result = new CloneFlagValidator().Validate(req);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("key"));
    }

    [Fact]
    public void GetInsights_FromZeroAndUndefinedInterval_InvalidErrors()
    {
        var req = new GetInsights
        {
            EnvId = Guid.NewGuid(),
            Filter = new StatsByVariationFilter { FeatureFlagKey = "k", IntervalType = "n/a", From = 0, To = 0 }
        };

        var result = new GetInsightsValidator().Validate(req);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("from"));
        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("to"));
        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("intervalType"));
    }

    [Fact]
    public void GetVariationReferences_MissingIds_RequiredErrors()
    {
        var result = new GetVariationReferencesValidator().Validate(new GetVariationReferences());

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Required("featureFlagId"));
        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Required("variationId"));
    }
}
