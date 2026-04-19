using Application.Checkout;

namespace Application.Services;

public interface ICheckoutService
{
    Task<CheckoutSessionVm?> CreateSessionAsync(
        long amount,
        string currency,
        string successUrl,
        string cancelUrl,
        CancellationToken cancellationToken = default);
}
