namespace Application.Billing;

public class DowngradeSubscription : Subscription, IRequest<bool>;

public class DowngradeSubscriptionValidator : AbstractValidator<DowngradeSubscription>
{
    public DowngradeSubscriptionValidator()
    {
        Include(new SubscriptionValidator());
    }
}

public class DowngradeSubscriptionHandler(IBillingService billingService)
    : IRequestHandler<DowngradeSubscription, bool>
{
    public async Task<bool> Handle(DowngradeSubscription request, CancellationToken cancellationToken)
    {
        var success = await billingService.DowngradeSubscriptionAsync(request);
        return success;
    }
}