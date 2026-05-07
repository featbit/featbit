namespace Application.Billing;

public class GetProrationPreview : Subscription, IRequest<string>;

public class UpgradeSubscriptionPreviewHandler(IBillingService billingService)
    : IRequestHandler<GetProrationPreview, string>
{
    public async Task<string> Handle(GetProrationPreview request, CancellationToken cancellationToken)
    {
        var preview = await billingService.GetProrationPreviewAsync(request);
        return preview;
    }
}