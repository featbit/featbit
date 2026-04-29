namespace Application.Billing;

public class UpgradeSubscription : Subscription, IRequest<bool>;

public class UpgradeSubscriptionValidator : AbstractValidator<UpgradeSubscription>
{
    public UpgradeSubscriptionValidator()
    {
        Include(new SubscriptionValidator());
    }
}

public class UpgradeSubscriptionHandler(IBillingService billingService)
    : IRequestHandler<UpgradeSubscription, bool>
{
    public async Task<bool> Handle(UpgradeSubscription request, CancellationToken cancellationToken)
    {
        var success = await billingService.UpgradeSubscriptionAsync(request);
        return success;
    }
}