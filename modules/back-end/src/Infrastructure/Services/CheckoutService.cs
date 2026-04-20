using System.Net.Http.Json;
using Application.Checkout;
using Application.Cloud;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Infrastructure.Services;

public class CheckoutService(
    HttpClient httpClient,
    IOptions<CloudOptions> options,
    ILogger<CheckoutService> logger)
    : ICheckoutService
{
    public async Task<CheckoutSessionVm?> CreateCheckoutSessionAsync(
        long amount,
        string currency,
        CancellationToken cancellationToken = default)
    {
        var payload = new
        {
            amount,
            currency
        };
        
        var response = await httpClient.PostAsJsonAsync($"{options.Value.ServiceUrl}/api/subscriptions/checkout", payload, cancellationToken);
        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<CheckoutSessionResponse>(cancellationToken: cancellationToken);
        
        return new CheckoutSessionVm
        {
            Url = result!.Url
        };
    }

    private class CheckoutSessionResponse
    {
        public string Url { get; set; }
    }
}
