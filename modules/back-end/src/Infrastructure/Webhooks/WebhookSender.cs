using System.Net;
using System.Net.Mime;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Domain.Webhooks;
using HandlebarsDotNet;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Webhooks;

public class WebhookSender : IWebhookSender
{
    private readonly HttpClient _client;
    private readonly IWebhookService _webhookService;
    private readonly ILogger<WebhookSender> _logger;

    private readonly int _maxAttempts = 3;
    private readonly TimeSpan _retryInterval = TimeSpan.FromSeconds(2);

    public WebhookSender(HttpClient client, IWebhookService webhookService, ILogger<WebhookSender> logger)
    {
        _client = client;
        _webhookService = webhookService;
        _logger = logger;
    }

    public async Task<WebhookDelivery> SendAsync(Webhook webhook, Dictionary<string, object> dataObject)
    {
        var events = dataObject["events"].ToString()!;

        string payload;
        try
        {
            var template = Handlebars.Compile(webhook.PayloadTemplate);
            payload = template(dataObject);
            JsonDocument.Parse(payload);
        }
        catch (Exception ex)
        {
            var delivery = new WebhookDelivery(webhook.Id, events);
            var error = new
            {
                message = "Cannot construct a valid JSON payload by using the template and the data object",
                dataObject,
                payloadTemplate = webhook.PayloadTemplate,
                exceptionMessage = ex.Message,
            };
            delivery.SetError(error);

            await AddDeliveryAsync(delivery);
            return delivery;
        }

        var deliveryId = Guid.NewGuid().ToString("D");
        WebhookDelivery lastDelivery = null!;;
        for (var attempt = 0; attempt < _maxAttempts; attempt++)
        {
            if (attempt > 0)
            {
                await Task.Delay(_retryInterval);
            }

            lastDelivery = await SendCoreAsync();
            if (lastDelivery.Success)
            {
                break;
            }
        }

        return lastDelivery;

        async Task<WebhookDelivery> SendCoreAsync()
        {
            var delivery = new WebhookDelivery(webhook.Id, dataObject["events"].ToString());

            var request = CreateWebhookHttpRequest(webhook, deliveryId, events, payload);
            delivery.AddRequest(webhook.Url, request.Headers, payload);
            delivery.Started();
            try
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
                var response = await _client.SendAsync(request, cts.Token);
                await delivery.AddResponseAsync(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception occurred while sending webhook '{Name}'", webhook.Name);

                var error = new
                {
                    message = ex.Message,
                    stackTrace = ex.StackTrace,
                };
                delivery.SetError(error);
            }

            delivery.Ended();

            // Add delivery log
            await AddDeliveryAsync(delivery);
            return delivery;
        }
    }

    private static HttpRequestMessage CreateWebhookHttpRequest(
        Webhook webhook,
        string deliveryId,
        string events,
        string payload)
    {
        var uri = string.IsNullOrEmpty(webhook.Url) ? null : new Uri(webhook.Url, UriKind.RelativeOrAbsolute);
        var httpRequest = new HttpRequestMessage(HttpMethod.Post, uri)
        {
            Version = HttpVersion.Version11,
            VersionPolicy = HttpVersionPolicy.RequestVersionOrLower
        };

        // add built-in headers
        httpRequest.Headers.Add(WebhookHeaders.Delivery, deliveryId);
        httpRequest.Headers.Add(WebhookHeaders.Event, events);
        httpRequest.Headers.Add(WebhookHeaders.HookId, webhook.Id.ToString("D"));
        if (!string.IsNullOrWhiteSpace(webhook.Secret))
        {
            var signature = ComputeSignature();
            httpRequest.Headers.Add(WebhookHeaders.Signature, $"sha256={signature}");
        }

        // add user specified headers
        foreach (var header in webhook.Headers)
        {
            if (httpRequest.Headers.Contains(header.Key))
            {
                httpRequest.Headers.Remove(header.Key);
            }

            httpRequest.Headers.TryAddWithoutValidation(header.Key, header.Value);
        }

        // add content
        var content = new StringContent(payload, Encoding.UTF8, MediaTypeNames.Application.Json);
        httpRequest.Content = content;

        return httpRequest;

        string ComputeSignature()
        {
            var key = Encoding.UTF8.GetBytes(webhook.Secret);
            using var hmac = new HMACSHA256(key);
            var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(payload));

            var signature = ToHexString(hash);
            return signature;

            string ToHexString(IReadOnlyCollection<byte> bytes)
            {
                var builder = new StringBuilder(bytes.Count * 2);
                foreach (var b in bytes)
                {
                    builder.Append($"{b:x2}");
                }

                return builder.ToString();
            }
        }
    }

    private async Task AddDeliveryAsync(WebhookDelivery theDelivery)
    {
        try
        {
            await _webhookService.AddDeliveryAsync(theDelivery);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to add webhook delivery log");
        }
    }
}