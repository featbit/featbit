using Application.Bases;
using Domain.Workspaces;

namespace Application.Billing;

public class Subscription
{
    public Guid WorkspaceId { get; set; }

    public string Plan { get; set; }

    public string BillingCycle { get; set; }

    public int Mau { get; set; }

    public string[] AddOnFeatures { get; set; }

    public override string ToString()
    {
        return
            $"WorkspaceId: {WorkspaceId}, Plan: {Plan}, Billing Cycle: {BillingCycle}, Mau: {Mau}, ExtraFeatures: [{string.Join(", ", AddOnFeatures)}]";
    }
}

public class SubscriptionValidator : AbstractValidator<Subscription>
{
    public SubscriptionValidator()
    {
        RuleFor(x => x.Plan)
            .NotEmpty()
            .Must(BillingPlans.IsDefined)
            .WithErrorCode(ErrorCodes.Invalid("plan"));

        RuleFor(x => x.Mau)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("mau"))
            .GreaterThan(1_000).WithErrorCode(ErrorCodes.Invalid("mau"));

        RuleFor(x => x.BillingCycle)
            .Must(BillingCycle.IsDefined)
            .WithErrorCode(ErrorCodes.Invalid("interval"));

        RuleFor(x => x.AddOnFeatures)
            .Must(features => features.All(LicenseFeatures.IsDefined))
            .WithErrorCode(ErrorCodes.Invalid("addOnFeatures"));
    }
}