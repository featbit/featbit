namespace Application.Billing;

public class GetInvoices : IRequest<string>
{
    public Guid WorkspaceId { get; set; }
}

public class GetInvoicesHandler(IBillingService billingService)
    : IRequestHandler<GetInvoices, string>
{
    public async Task<string> Handle(GetInvoices request, CancellationToken cancellationToken)
    {
        var invoices = await billingService.GetInvoicesAsync(request.WorkspaceId);
        return invoices;
    }
}