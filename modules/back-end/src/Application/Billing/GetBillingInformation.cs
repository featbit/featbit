namespace Application.Billing;

public class GetBillingInformation : IRequest<string>
{
    public Guid WorkspaceId { get; set; }
}

public class GetBillingInformationHandler(IBillingService billingService)
    : IRequestHandler<GetBillingInformation, string>
{
    public async Task<string> Handle(GetBillingInformation request, CancellationToken cancellationToken)
    {
        var billingInformation = await billingService.GetBillingInformationAsync(request.WorkspaceId);

        return billingInformation;
    }
}