namespace Application.Billing;

public class CreateSubscription : Subscription, IRequest<string>;

public class CreateSubscriptionValidator : AbstractValidator<CreateSubscription>
{
    public CreateSubscriptionValidator()
    {
        Include(new SubscriptionValidator());
    }
}

public class CreateSubscriptionHandler(IBillingService billingService)
    : IRequestHandler<CreateSubscription, string>
{
    public async Task<string> Handle(CreateSubscription request, CancellationToken cancellationToken)
    {
        var session = await billingService.CreateSubscriptionAsync(request);
        return session;
    }
}