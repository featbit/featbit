using System.Net.Http.Json;
using Application.Checkout;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services;

public class CheckoutService(
    HttpClient httpClient,
    ILogger<CheckoutService> logger)
    : ICheckoutService
{
    public async Task<CheckoutSessionVm?> CreateCheckoutSessionAsync(
        long amount,
        string currency,
        CancellationToken cancellationToken = default)
    {
        var payload = new { amount, currency };

        try
        {
            var response = await httpClient.PostAsJsonAsync("api/subscriptions/checkout", payload, cancellationToken);
            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<CheckoutSessionResponse>(cancellationToken: cancellationToken);
            if (result?.Url is null)
            {
                logger.LogError("Checkout service returned a null or invalid response.");
                return null;
            }

            return new CheckoutSessionVm { Url = result.Url };
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create checkout session for amount {Amount} {Currency}.", amount, currency);
            return null;
        }
    }

    private class CheckoutSessionResponse
    {
        public string? Url { get; set; }
    }
}
