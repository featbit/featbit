using System.Net.Http.Json;
using Application.Checkout;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Infrastructure.Services;

public class CheckoutOptions
{
    public const string Checkout = nameof(Checkout);

    public string BaseUrl { get; set; }

    public string ApiKey { get; set; }
}

public class CheckoutService(
    HttpClient httpClient,
    IOptions<CheckoutOptions> options,
    ILogger<CheckoutService> logger)
    : ICheckoutService
{
    public async Task<CheckoutSessionVm?> CreateSessionAsync(
        long amount,
        string currency,
        CancellationToken cancellationToken = default)
    {
        var payload = new
        {
            amount,
            currency
        };
        
        var response = await httpClient.PostAsJsonAsync($"{options.Value.BaseUrl}/api/subscriptions/checkout", payload, cancellationToken);
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
