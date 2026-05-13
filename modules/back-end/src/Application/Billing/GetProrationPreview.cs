namespace Application.Billing;

public class GetProrationPreview : Subscription, IRequest<string>;

public class GetProrationPreviewValidator : AbstractValidator<GetProrationPreview>
{
    public GetProrationPreviewValidator()
    {
        Include(new SubscriptionValidator());
    }
}

public class GetProrationPreviewHandler(IBillingService billingService)
    : IRequestHandler<GetProrationPreview, string>
{
    public async Task<string> Handle(GetProrationPreview request, CancellationToken cancellationToken)
    {
        var preview = await billingService.GetProrationPreviewAsync(request);
        return preview;
    }
}