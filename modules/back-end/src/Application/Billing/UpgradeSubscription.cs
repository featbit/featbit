namespace Application.Billing;

public class UpgradeSubscription : Subscription, IRequest<string>;

public class UpgradeSubscriptionValidator : AbstractValidator<UpgradeSubscription>
{
    public UpgradeSubscriptionValidator()
    {
        Include(new SubscriptionValidator());
    }
}

public class UpgradeSubscriptionHandler(IBillingService billingService)
    : IRequestHandler<UpgradeSubscription, string>
{
    public async Task<string> Handle(UpgradeSubscription request, CancellationToken cancellationToken)
    {
        var response = await billingService.UpgradeSubscriptionAsync(request);
        return response;
    }
}