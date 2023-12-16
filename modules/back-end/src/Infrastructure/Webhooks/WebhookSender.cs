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

    private readonly int _maxAttempts;
    private readonly TimeSpan _retryInterval;

    public WebhookSender(HttpClient client, IWebhookService webhookService, ILogger<WebhookSender> logger)
    {
        _client = client;
        _webhookService = webhookService;
        _logger = logger;

        _maxAttempts = 3;
        _retryInterval = TimeSpan.FromSeconds(2);
    }

    public async Task SendAsync(Webhook webhook, Dictionary<string, object> dataObject)
    {
        string payload;
        try
        {
            var template = Handlebars.Compile(webhook.PayloadTemplate);
            payload = template(dataObject);
            JsonDocument.Parse(payload);
        }
        catch (Exception ex)
        {
            var delivery = new WebhookDelivery(webhook.Id, dataObject["events"].ToString())
            {
                Error = new
                {
                    message = "Cannot construct a valid JSON payload by using the template and the data object",
                    dataObject,
                    payloadTemplate = webhook.PayloadTemplate,
                    exceptionMessage = ex.Message,
                }
            };
            await AddDeliveryAsync(delivery);
            return;
        }

        var deliveryId = Guid.NewGuid();
        var request = NewWebhookRequest();
        var success = false;

        for (var attempt = 0; attempt < _maxAttempts; attempt++)
        {
            if (attempt > 0)
            {
                await Task.Delay(_retryInterval);
            }

            var delivery = new WebhookDelivery(webhook.Id, dataObject["events"].ToString());
            delivery.AddRequest(webhook.Url, request.Headers, payload);
            delivery.Started();
            try
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
                var response = await _client.SendAsync(request, cts.Token);
                await delivery.AddResponseAsync(response);

                success = true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception occurred while sending webhook '{Name}'", webhook.Name);
                delivery.Error = new
                {
                    message = ex.Message,
                    stackTrace = ex.StackTrace,
                };
            }

            delivery.Ended();

            // for each attempt, add a delivery log
            await AddDeliveryAsync(delivery);

            if (success)
            {
                break;
            }
        }

        return;

        HttpRequestMessage NewWebhookRequest()
        {
            var uri = string.IsNullOrEmpty(webhook.Url) ? null : new Uri(webhook.Url, UriKind.RelativeOrAbsolute);
            var httpRequest = new HttpRequestMessage(HttpMethod.Post, uri)
            {
                Version = HttpVersion.Version11,
                VersionPolicy = HttpVersionPolicy.RequestVersionOrLower
            };

            // add built-in headers
            httpRequest.Headers.Add(WebhookHeaders.Delivery, deliveryId.ToString("D"));
            httpRequest.Headers.Add(WebhookHeaders.Event, dataObject["events"].ToString());
            httpRequest.Headers.Add(WebhookHeaders.HookId, webhook.Id.ToString("D"));
            if (!string.IsNullOrWhiteSpace(webhook.Secret))
            {
                var signature = ComputeSignature(webhook.Secret, payload);
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
        }

        async Task AddDeliveryAsync(WebhookDelivery theDelivery)
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

    private static string ComputeSignature(string secret, string payload)
    {
        var key = Encoding.UTF8.GetBytes(secret);
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