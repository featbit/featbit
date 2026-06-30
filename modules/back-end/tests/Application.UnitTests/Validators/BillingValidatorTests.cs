using Application.Bases;
using Application.Billing;
using Domain.Workspaces;

namespace Application.UnitTests.Validators;

public class BillingValidatorTests
{
    private static Subscription Valid() => new()
    {
        WorkspaceId = Guid.NewGuid(),
        Plan = BillingPlans.All.First(),
        BillingCycle = BillingCycle.All.First(),
        Mau = 1_000,
        AddOnFeatures = Array.Empty<string>()
    };

    [Fact]
    public void Subscription_AllFieldsValid_NoErrors()
    {
        var result = new SubscriptionValidator().Validate(Valid());

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Subscription_UndefinedPlan_PlanInvalidError()
    {
        var sub = Valid();
        sub.Plan = "free-plus-plus";

        var result = new SubscriptionValidator().Validate(sub);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("plan"));
    }

    [Fact]
    public void Subscription_MauBelow1000_MauInvalidError()
    {
        var sub = Valid();
        sub.Mau = 999;

        var result = new SubscriptionValidator().Validate(sub);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("mau"));
    }

    [Fact]
    public void Subscription_UndefinedCycle_IntervalInvalidError()
    {
        var sub = Valid();
        sub.BillingCycle = "biennial";

        var result = new SubscriptionValidator().Validate(sub);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("interval"));
    }

    [Fact]
    public void Subscription_NullAddOns_NoError()
    {
        var sub = Valid();
        sub.AddOnFeatures = null;

        var result = new SubscriptionValidator().Validate(sub);

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Subscription_UnknownAddOnFeature_AddOnFeaturesInvalidError()
    {
        var sub = Valid();
        sub.AddOnFeatures = new[] { "made-up-feature" };

        var result = new SubscriptionValidator().Validate(sub);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("addOnFeatures"));
    }

    [Fact]
    public void CreateSubscription_DelegatesToSubscriptionValidator()
    {
        var bad = new CreateSubscription
        {
            Plan = "nope",
            BillingCycle = BillingCycle.All.First(),
            Mau = 1_000
        };

        var result = new CreateSubscriptionValidator().Validate(bad);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("plan"));
    }

    [Fact]
    public void UpgradeSubscription_DelegatesToSubscriptionValidator()
    {
        var bad = new UpgradeSubscription { Mau = 0, Plan = BillingPlans.All.First(), BillingCycle = BillingCycle.All.First() };

        var result = new UpgradeSubscriptionValidator().Validate(bad);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("mau"));
    }

    [Fact]
    public void Subscription_ToString_IncludesAllFields()
    {
        var sub = Valid();
        sub.AddOnFeatures = new[] { "a", "b" };

        var s = sub.ToString();

        Assert.Contains(sub.WorkspaceId.ToString(), s);
        Assert.Contains(sub.Plan, s);
        Assert.Contains("AddOnFeatures: [a, b]", s);
    }
}
