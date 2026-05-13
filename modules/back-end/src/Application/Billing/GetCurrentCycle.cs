namespace Application.Billing;

public class GetCurrentCycle : IRequest<string>
{
    public Guid WorkspaceId { get; set; }
}

public class GetCurrentCycleHandler(IBillingService billingService) : IRequestHandler<GetCurrentCycle, string>
{
    public async Task<string> Handle(GetCurrentCycle request, CancellationToken cancellationToken)
    {
        var currentCycle = await billingService.GetCurrentCycleAsync(request.WorkspaceId);
        return currentCycle;
    }
}