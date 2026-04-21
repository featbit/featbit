using System.Net.Http.Json;
using Application.Subscription;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services;

public class SubscriptionService(
    HttpClient httpClient,
    ILogger<SubscriptionService> logger)
    : ISubscriptionService
{
    public async Task<CheckoutSessionVm?> CreateCheckoutSessionAsync(
        string email,
        Guid workspaceId,
        string plan,
        int mau,
        string[] extraFeatures,
        CancellationToken cancellationToken = default)
    {
        var payload = new { email, workspaceId, plan, mau, extraFeatures};

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
            logger.LogError(ex, "Failed to create checkout session for {email} {workspaceId} {plan} {mau} {extraFeatures}.", email, workspaceId, plan, mau, string.Join(',', extraFeatures));
            return null;
        }
    }

    private class CheckoutSessionResponse
    {
        public string? Url { get; set; }
    }
}
