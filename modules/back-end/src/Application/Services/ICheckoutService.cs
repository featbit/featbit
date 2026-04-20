using Application.Checkout;

namespace Application.Services;

public interface ICheckoutService
{
    Task<CheckoutSessionVm?> CreateCheckoutSessionAsync(
        long amount,
        string currency,
        CancellationToken cancellationToken = default);
}
