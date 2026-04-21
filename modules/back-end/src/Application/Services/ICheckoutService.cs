using Application.Checkout;

namespace Application.Services;

public interface ICheckoutService
{
    Task<CheckoutSessionVm?> CreateCheckoutSessionAsync(
        long unitAmount,
        CancellationToken cancellationToken = default);
}
