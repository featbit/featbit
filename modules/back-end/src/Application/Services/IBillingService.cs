using Application.Billing;

namespace Application.Services;

public interface IBillingService
{
    Task<string> GetSubscriptionAsync(Guid workspaceId);

    Task<string> GetCurrentCycleAsync(Guid workspaceId);

    Task<string> CreateSubscriptionAsync(CreateSubscription request);

    Task<string> GetProrationPreviewAsync(GetProrationPreview request);

    Task<string> UpgradeSubscriptionAsync(UpgradeSubscription request);

    Task<string> DowngradeSubscriptionAsync(DowngradeSubscription request);

    Task<string> GetLicenseAsync(Guid workspaceId);

    Task<bool> CreateFreeLicenseAsync(Guid workspaceId, string email);

    Task<string> GetBillingInformationAsync(Guid workspaceId);

    Task<bool> UpdateBillingInformationAsync(Guid workspaceId, string payload);

    Task<string> GetInvoicesAsync(Guid workspaceId);
}