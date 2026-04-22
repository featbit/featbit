using System.Net.Http.Json;
using System.Text.Json;
using Application.Billing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services;

public class BillingService(
    IHttpClientFactory httpClientFactory,
    IConfiguration configuration,
    ILogger<BillingService> logger)
    : IBillingService
{
    private readonly string _serviceUrl = configuration["Billing:ServiceUrl"] ?? string.Empty;
    private readonly string _serviceApiKey = configuration["Billing:ServiceApiKey"] ?? string.Empty;

    public async Task<CheckoutSession?> CreateCheckoutSessionAsync(
        CreateCheckoutSession request,
        CancellationToken cancellationToken = default)
    {
        var httpClient = CreateBillingServiceClient();

        try
        {
            var response = await httpClient.PostAsJsonAsync("api/subscriptions/checkout", request, cancellationToken);
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync(cancellationToken);

            using var json = JsonDocument.Parse(content);
            return json.RootElement.TryGetProperty("url", out var urlElement)
                ? new CheckoutSession(urlElement.GetString())
                : null;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create checkout session for {Request}.", request.ToString());
            return null;
        }
    }

    private HttpClient CreateBillingServiceClient()
    {
        var client = httpClientFactory.CreateClient();

        if (string.IsNullOrEmpty(_serviceUrl) || string.IsNullOrEmpty(_serviceApiKey))
        {
            throw new InvalidOperationException("Billing service configuration is missing.");
        }

        client.BaseAddress = new Uri(_serviceUrl);
        client.DefaultRequestHeaders.Add("X-Api-Key", _serviceApiKey);
        return client;
    }
}