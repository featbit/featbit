namespace Application.Billing;

public class GetLicense : IRequest<string>
{
    public Guid WorkspaceId { get; set; }
}

public class GetLicenseHandler(IBillingService billingService) : IRequestHandler<GetLicense, string>
{
    public async Task<string> Handle(GetLicense request, CancellationToken cancellationToken)
    {
        var license = await billingService.GetLicenseAsync(request.WorkspaceId);
        return license;
    }
}