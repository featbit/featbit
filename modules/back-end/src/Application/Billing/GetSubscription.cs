namespace Application.Billing;

public class GetSubscription : IRequest<string>
{
    public Guid WorkspaceId { get; set; }
}

public class GetSubscriptionHandler(IBillingService billingService)
    : IRequestHandler<GetSubscription, string>
{
    public async Task<string> Handle(GetSubscription request, CancellationToken cancellationToken)
    {
        var subscription = await billingService.GetSubscriptionAsync(request.WorkspaceId);
        return subscription;
    }
}