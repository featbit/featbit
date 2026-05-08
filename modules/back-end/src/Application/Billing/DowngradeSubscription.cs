namespace Application.Billing;

public class DowngradeSubscription : Subscription, IRequest<string>;

public class DowngradeSubscriptionValidator : AbstractValidator<DowngradeSubscription>
{
    public DowngradeSubscriptionValidator()
    {
        Include(new SubscriptionValidator());
    }
}

public class DowngradeSubscriptionHandler(IBillingService billingService)
    : IRequestHandler<DowngradeSubscription, string>
{
    public async Task<string> Handle(DowngradeSubscription request, CancellationToken cancellationToken)
    {
        var response = await billingService.DowngradeSubscriptionAsync(request);
        return response;
    }
}