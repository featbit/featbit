using Application.Bases;
using Application.Bases.Exceptions;
using Domain.Workspaces;

namespace Application.Billing;

public class CreateCheckoutSession : IRequest<CheckoutSession>
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

public class CreateCheckoutSessionValidator : AbstractValidator<CreateCheckoutSession>
{
    public CreateCheckoutSessionValidator()
    {
        RuleFor(x => x.Plan)
            .NotEmpty()
            .Must(BillingPlans.IsDefined)
            .WithErrorCode(ErrorCodes.Invalid("plan"));

        RuleFor(x => x.Mau)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("mau"))
            .GreaterThan(1000).WithErrorCode(ErrorCodes.Invalid("mau"));

        RuleFor(x => x.BillingCycle)
            .Must(BillingCycle.IsDefined)
            .WithErrorCode(ErrorCodes.Invalid("interval"));

        RuleFor(x => x.AddOnFeatures)
            .Must(features => features.All(LicenseFeatures.IsDefined))
            .WithErrorCode(ErrorCodes.Invalid("addOnFeatures"));
    }
}

public class CreateCheckoutSessionHandler(IBillingService billingService)
    : IRequestHandler<CreateCheckoutSession, CheckoutSession>
{
    public async Task<CheckoutSession> Handle(CreateCheckoutSession request, CancellationToken cancellationToken)
    {
        var session = await billingService.CreateCheckoutSessionAsync(request, cancellationToken);
        if (session == null)
        {
            throw new BusinessException(ErrorCodes.Failed("checkout-session"));
        }

        return session;
    }
}