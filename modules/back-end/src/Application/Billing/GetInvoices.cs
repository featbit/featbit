namespace Application.Billing;

public class GetInvoices : IRequest<string>
{
    public Guid WorkspaceId { get; set; }
}

public class GetInvoicesHandler(IBillingService billingService)
    : IRequestHandler<GetInvoices, string>
{
    public async ValueTask<string> Handle(GetInvoices request, CancellationToken cancellationToken)
    {
        var invoices = await billingService.GetInvoicesAsync(request.WorkspaceId);
        return invoices;
    }
}