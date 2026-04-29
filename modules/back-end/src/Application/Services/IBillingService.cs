using Application.Billing;

namespace Application.Services;

public interface IBillingService
{
    Task<string> GetSubscriptionAsync(Guid workspaceId);

    Task<string> CreateSubscriptionAsync(CreateSubscription request);

    Task<bool> UpgradeSubscriptionAsync(UpgradeSubscription request);

    Task<bool> DowngradeSubscriptionAsync(DowngradeSubscription request);

    Task<bool> CreateFreeLicenseAsync(Guid workspaceId, string email);

    Task<string> GetBillingInformationAsync(Guid workspaceId);

    Task<bool> UpdateBillingInformationAsync(Guid workspaceId, string payload);

    Task<string> GetInvoicesAsync(Guid workspaceId);
}