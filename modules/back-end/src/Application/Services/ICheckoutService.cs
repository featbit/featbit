using Application.Checkout;

namespace Application.Services;

public interface ICheckoutService
{
    Task<CheckoutSessionVm?> CreateSessionAsync(
        long amount,
        string currency,
        CancellationToken cancellationToken = default);
}
