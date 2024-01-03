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
    private readonly TimeSpan _timeout = TimeSpan.FromSeconds(10);
    private readonly TimeSpan _retryInterval = TimeSpan.FromSeconds(2);

    public WebhookSender(HttpClient client, IWebhookService webhookService, ILogger<WebhookSender> logger)
    {
        _client = client;
        _client.Timeout = _timeout;

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
                exceptionMessage = ex.Message
            };
            delivery.SetError(error);

            await AddDeliveryAsync(delivery);
            return delivery;
        }

        var deliveryId = Guid.NewGuid().ToString("D");
        WebhookDelivery lastDelivery = null!;
        for (var attempt = 0; attempt < _maxAttempts; attempt++)
        {
            if (attempt > 0)
            {
                await Task.Delay(_retryInterval);
            }

            var request = new WebhookRequest(deliveryId, webhook, events, payload);
            lastDelivery = await SendAsync(request);

            // Add delivery log
            await AddDeliveryAsync(lastDelivery);

            if (lastDelivery.Success)
            {
                break;
            }
        }

        return lastDelivery;
    }

    public async Task<WebhookDelivery> SendAsync(WebhookRequest request)
    {
        var delivery = new WebhookDelivery(request.Id, request.Events);

        var httpRequest = CreateWebhookHttpRequest();
        delivery.AddRequest(request.Url, httpRequest.Headers, request.Payload);
        delivery.Started();
        try
        {
            var response = await _client.SendAsync(httpRequest);
            await delivery.AddResponseAsync(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception occurred while sending webhook '{Name}'", request.Name);

            var error = new
            {
                message = ex.Message
            };
            delivery.SetError(error);
        }

        delivery.Ended();
        return delivery;

        HttpRequestMessage CreateWebhookHttpRequest()
        {
            var uri = string.IsNullOrEmpty(request.Url) ? null : new Uri(request.Url, UriKind.RelativeOrAbsolute);
            var message = new HttpRequestMessage(HttpMethod.Post, uri)
            {
                Version = HttpVersion.Version11,
                VersionPolicy = HttpVersionPolicy.RequestVersionOrLower
            };

            // add built-in headers
            message.Headers.Add(WebhookHeaders.Delivery, request.DeliveryId);
            message.Headers.Add(WebhookHeaders.Event, request.Events);
            message.Headers.Add(WebhookHeaders.HookId, request.Id.ToString("D"));
            if (!string.IsNullOrWhiteSpace(request.Secret))
            {
                var signature = ComputeSignature();
                message.Headers.Add(WebhookHeaders.Signature, $"sha256={signature}");
            }

            // add user specified headers
            foreach (var header in request.Headers)
            {
                if (message.Headers.Contains(header.Key))
                {
                    message.Headers.Remove(header.Key);
                }

                message.Headers.TryAddWithoutValidation(header.Key, header.Value);
            }

            // add content
            var content = new StringContent(request.Payload, Encoding.UTF8, MediaTypeNames.Application.Json);
            message.Content = content;

            return message;
        }

        string ComputeSignature()
        {
            var key = Encoding.UTF8.GetBytes(request.Secret);
            using var hmac = new HMACSHA256(key);
            var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(request.Payload));

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