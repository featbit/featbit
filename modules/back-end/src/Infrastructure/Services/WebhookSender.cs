using System.Net;
using System.Net.Mime;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Domain.Utils;
using Domain.Webhooks;
using Domain.Observability;
using HandlebarsDotNet;
using Microsoft.Extensions.Logging;
using Microsoft.Security.AntiSSRF;

namespace Infrastructure.Services;

public partial class WebhookSender : IWebhookSender
{
    /// <summary>
    /// Duration at or above which a webhook attempt span is always retained. The client timeout is
    /// 10 seconds, so this retains anything in the slowest part of the range without retaining
    /// healthy deliveries.
    /// </summary>
    private const double SlowAttemptThresholdMs = 5_000d;

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
        var metrics = WebhookMetrics.Current;
        var events = dataObject["events"].ToString()!;

        string payload;
        JsonDocument jsonDocument;
        try
        {
            var template = Handlebars.Compile(webhook.PayloadTemplate);
            payload = template(dataObject);
            jsonDocument = JsonDocument.Parse(payload);
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

            metrics.RecordDelivery(Outcomes.Failure, WebhookReasons.TemplateError);

            await AddDeliveryAsync(delivery);
            return delivery;
        }

        if (webhook.PreventEmptyPayloads && jsonDocument.RootElement.IsEmptyObject())
        {
            metrics.RecordDelivery(Outcomes.Dropped, WebhookReasons.EmptyPayload);

            return WebhookDelivery.Ignored("Not allowed to send an empty JSON object", webhook.Url, payload);
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

        metrics.RecordDelivery(
            lastDelivery.Success ? Outcomes.Success : Outcomes.Failure,
            lastDelivery.Success ? WebhookReasons.Delivered : WebhookReasons.HttpError);

        return lastDelivery;
    }

    public async Task<WebhookDelivery> SendAsync(WebhookRequest request)
    {
        var delivery = new WebhookDelivery(request.Id, request.Events);
        delivery.Started();

        var start = Stopwatch.GetTimestamp();
        var reason = WebhookReasons.Delivered;

        // T5 — one span per HTTP attempt. The URL is deliberately not a tag: it is
        // customer-supplied and frequently carries a secret in its path or query.
        using var trace = TailSampledTrace.Start(
            TraceCategories.ScheduledWork,
            "webhook.attempt",
            ActivityKind.Client,
            SlowAttemptThresholdMs);

        try
        {
            var httpRequest = CreateWebhookHttpRequest();
            delivery.AddRequest(request.Url, httpRequest.Headers, request.Payload);

            var response = await _client.SendAsync(httpRequest);
            await delivery.AddResponseAsync(response);

            reason = response.IsSuccessStatusCode
                ? WebhookReasons.Delivered
                : WebhookReasons.HttpError;

            trace.SetTag("http.response.status_code", (int)response.StatusCode);
        }
        catch (AntiSSRFException ex)
        {
            Log.BlockedByAntiSsrf(_logger, request.Url, ex.Message);

            var error = new
            {
                message = "Webhook target is not allowed. The URL must be an absolute http/https URL that resolves to a public IP address."
            };
            delivery.SetError(error);

            reason = WebhookReasons.Blocked;
        }
        catch (Exception ex)
        {
            Log.ErrorSendWebhook(_logger, request.Name, ex);

            var error = new
            {
                message = ex.Message
            };
            delivery.SetError(error);

            reason = WebhookReasons.TransportError;
        }

        WebhookMetrics.Current.RecordAttempt(
            reason == WebhookReasons.Delivered ? Outcomes.Success : Outcomes.Failure,
            reason,
            Stopwatch.GetElapsedTime(start));

        trace.Ended(
            reason == WebhookReasons.Delivered ? Outcomes.Success : Outcomes.Failure, reason);

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
            Log.ErrorAddDeliveryLog(_logger, ex);
        }
    }
}