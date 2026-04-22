using Application.Billing;

namespace Application.Services;

public interface IBillingService
{
    Task<CheckoutSession> CreateCheckoutSessionAsync(
        CreateCheckoutSession request,
        CancellationToken cancellationToken = default
    );
}