using Application.Bases;
using Application.Segments;
using Domain.Segments;
using Domain.Targeting;

namespace Application.UnitTests.Validators;

public class SegmentValidatorTests
{
    private static CreateSegment ValidCreate() => new()
    {
        Type = SegmentType.EnvironmentSpecific,
        Name = "seg",
        Key = "seg-key",
        Scopes = new[] { "project/x:env/y" }
    };

    [Fact]
    public void CreateSegment_AllFieldsValid_NoErrors()
    {
        var result = new CreateSegmentValidator().Validate(ValidCreate());

        Assert.True(result.IsValid);
    }

    [Fact]
    public void CreateSegment_UndefinedType_TypeInvalidError()
    {
        var req = ValidCreate();
        req.Type = "bogus";

        var result = new CreateSegmentValidator().Validate(req);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("type"));
    }

    [Fact]
    public void CreateSegment_EmptyName_NameInvalidError()
    {
        var req = ValidCreate();
        req.Name = string.Empty;

        var result = new CreateSegmentValidator().Validate(req);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("name"));
    }

    [Fact]
    public void CreateSegment_KeyWithIllegalChars_KeyInvalidError()
    {
        var req = ValidCreate();
        req.Key = "bad key";

        var result = new CreateSegmentValidator().Validate(req);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("key"));
    }

    [Fact]
    public void CreateSegment_EmptyScopes_ScopesInvalidError()
    {
        var req = ValidCreate();
        req.Scopes = Array.Empty<string>();

        var result = new CreateSegmentValidator().Validate(req);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("scopes"));
    }

    [Fact]
    public void CreateSegment_WildcardScope_ScopesInvalidError()
    {
        var req = ValidCreate();
        req.Scopes = new[] { "*" };

        var result = new CreateSegmentValidator().Validate(req);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("scopes"));
    }

    [Fact]
    public void UpdateName_NameProvided_NoErrors()
    {
        var result = new Application.Segments.UpdateNameValidator().Validate(new Application.Segments.UpdateName { Name = "x" });

        Assert.True(result.IsValid);
    }

    [Fact]
    public void UpdateName_LongerThan128_NameInvalidError()
    {
        var result = new Application.Segments.UpdateNameValidator().Validate(new Application.Segments.UpdateName { Name = new string('x', 129) });

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("name"));
    }

    [Fact]
    public void UpdateTargeting_RuleWithoutSegmentCondition_NoErrors()
    {
        var rule = new MatchRule
        {
            Id = "r1",
            Conditions = new[] { new Condition { Id = "c", Property = "email", Op = "is", Value = "x" } }
        };
        var request = new UpdateTargeting(Guid.NewGuid(), new UpdateTargetingPayload { Rules = new[] { rule } }, Array.Empty<Domain.Policies.PolicyStatement>());

        var result = new UpdateTargetingValidator().Validate(request);

        Assert.True(result.IsValid);
    }

    [Fact]
    public void UpdateTargeting_RuleWithSegmentCondition_RulesInvalidError()
    {
        var rule = new MatchRule
        {
            Id = "r1",
            Conditions = new[] { new Condition { Id = "c", Property = SegmentConsts.ConditionProperties.First(), Op = "is in", Value = "[]" } }
        };
        var request = new UpdateTargeting(Guid.NewGuid(), new UpdateTargetingPayload { Rules = new[] { rule } }, Array.Empty<Domain.Policies.PolicyStatement>());

        var result = new UpdateTargetingValidator().Validate(request);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("rules"));
    }
}
