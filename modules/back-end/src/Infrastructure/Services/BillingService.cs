using System.Net.Http.Json;
using System.Net.Mime;
using System.Text;
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
    private readonly string _serviceHost = configuration["Billing:ServiceHost"] ?? string.Empty;
    private readonly string _serviceApiKey = configuration["Billing:ApiKey"] ?? string.Empty;

    public async Task<string?> CreateSubscriptionAsync(CreateSubscription request)
    {
        var httpClient = CreateBillingServiceClient();

        try
        {
            var response = await httpClient.PostAsJsonAsync("api/subscriptions/checkout", request);
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync();
            return content;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Exception occurred while creating subscription for {Request}.", request.ToString());
            return null;
        }
    }

    public async Task<bool> UpgradeSubscriptionAsync(UpgradeSubscription request)
    {
        var httpClient = CreateBillingServiceClient();
        const string route = "/api/subscriptions/upgrade";

        try
        {
            var response = await httpClient.PostAsJsonAsync(route, request);
            response.EnsureSuccessStatusCode();

            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Exception occurred while upgrading subscription for {Request}.", request.ToString());
            return false;
        }
    }

    public async Task<bool> DowngradeSubscriptionAsync(DowngradeSubscription request)
    {
        var httpClient = CreateBillingServiceClient();
        const string route = "/api/subscriptions/downgrade";

        try
        {
            var response = await httpClient.PostAsJsonAsync(route, request);
            response.EnsureSuccessStatusCode();

            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Exception occurred while downgrading subscription for {Request}.", request.ToString());

            return false;
        }
    }

    public async Task<string?> GetSubscriptionAsync(Guid workspaceId)
    {
        var httpClient = CreateBillingServiceClient();
        var route = $"api/subscriptions/{workspaceId}";

        try
        {
            var subscription = await httpClient.GetStringAsync(route);
            return subscription;
        }
        catch (Exception ex)
        {
            logger.LogError(
                ex,
                "Exception occurred while retrieving subscription for workspace {WorkspaceId}.",
                workspaceId
            );

            return null;
        }
    }

    public async Task<bool> CreateFreeLicenseAsync(Guid workspaceId, string email)
    {
        var httpClient = CreateBillingServiceClient();
        var payload = new { email };
        var route = $"api/subscriptions/{workspaceId}/free-license";

        try
        {
            var response = await httpClient.PostAsJsonAsync(route, payload);
            response.EnsureSuccessStatusCode();

            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(
                ex,
                "Exception occurred while creating free license for workspace {WorkspaceId} with email {Email}.",
                workspaceId, email
            );

            return false;
        }
    }

    public async Task<string?> GetBillingInformationAsync(Guid workspaceId)
    {
        var httpClient = CreateBillingServiceClient();
        var route = $"api/billing/{workspaceId}/info";

        try
        {
            return await httpClient.GetStringAsync(route);
        }
        catch (Exception ex)
        {
            logger.LogError(
                ex,
                "Exception occurred while retrieving billing information for workspace {WorkspaceId}.", workspaceId
            );

            return null;
        }
    }

    public async Task<bool> UpdateBillingInformationAsync(Guid workspaceId, string payload)
    {
        var httpClient = CreateBillingServiceClient();
        var route = $"api/billing/{workspaceId}/info";

        try
        {
            var content = new StringContent(payload, Encoding.UTF8, MediaTypeNames.Application.Json);
            var response = await httpClient.PutAsync(route, content);
            response.EnsureSuccessStatusCode();

            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(
                ex,
                "Exception occurred while updating billing information for workspace {WorkspaceId}. Payload: {Payload}",
                workspaceId, payload
            );

            return false;
        }
    }

    public async Task<string?> GetInvoicesAsync(Guid workspaceId)
    {
        var httpClient = CreateBillingServiceClient();
        var route = $"api/billing/{workspaceId}/invoices";

        try
        {
            var invoices = await httpClient.GetStringAsync(route);
            return invoices;
        }
        catch (Exception ex)
        {
            logger.LogError(
                ex,
                "Exception occurred while retrieving invoices for workspace {WorkspaceId}.", workspaceId
            );

            return null;
        }
    }

    private HttpClient CreateBillingServiceClient()
    {
        var client = httpClientFactory.CreateClient();

        if (string.IsNullOrEmpty(_serviceHost) || string.IsNullOrEmpty(_serviceApiKey))
        {
            throw new InvalidOperationException("Billing service configuration is missing.");
        }

        client.BaseAddress = new Uri(_serviceHost);
        client.DefaultRequestHeaders.Add("X-Api-Key", _serviceApiKey);
        return client;
    }
}

public class NoopBillingService : IBillingService
{
    public Task<string> GetSubscriptionAsync(Guid workspaceId) => Task.FromResult(string.Empty);
    public Task<string?> CreateSubscriptionAsync(CreateSubscription request) => Task.FromResult<string?>(null);
    public Task<bool> UpgradeSubscriptionAsync(UpgradeSubscription request) => Task.FromResult(false);
    public Task<bool> DowngradeSubscriptionAsync(DowngradeSubscription request) => Task.FromResult(false);
    public Task<bool> CreateFreeLicenseAsync(Guid workspaceId, string email) => Task.FromResult(false);
    public Task<string?> GetBillingInformationAsync(Guid workspaceId) => Task.FromResult<string?>(null);
    public Task<bool> UpdateBillingInformationAsync(Guid workspaceId, string payload) => Task.FromResult(false);
    public Task<string> GetInvoicesAsync(Guid workspaceId) => Task.FromResult(string.Empty);
}