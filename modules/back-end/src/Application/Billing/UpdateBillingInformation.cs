namespace Application.Billing;

public class UpdateBillingInformation : IRequest<bool>
{
    public Guid WorkspaceId { get; set; }

    public string Payload { get; set; }
}

public class UpdateBillingInformationHandler(IBillingService billingService)
    : IRequestHandler<UpdateBillingInformation, bool>
{
    public async Task<bool> Handle(UpdateBillingInformation request, CancellationToken cancellationToken)
    {
        var success = await billingService.UpdateBillingInformationAsync(request.WorkspaceId, request.Payload);
        return success;
    }
}