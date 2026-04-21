using Application.Subscription;

namespace Application.Services;

public interface ISubscriptionService
{
    Task<CheckoutSessionVm?> CreateCheckoutSessionAsync(
        string email,
        Guid workspaceId,
        string plan,
        int mau,
        string[] extraFeatures,
        CancellationToken cancellationToken = default);
}
