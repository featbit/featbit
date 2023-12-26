namespace Domain.Webhooks;

public class WebhookRequest
{
    public Guid Id { get; set; }

    public string DeliveryId { get; set; }

    public string Url { get; set; }

    public string Name { get; set; }

    public string Secret { get; set; }

    public KeyValuePair<string, string>[] Headers { get; set; }

    public string Events { get; set; }

    public string Payload { get; set; }

    public WebhookRequest()
    {
    }

    public WebhookRequest(
        string deliveryId,
        Webhook webhook,
        string events,
        string payload)
    {
        DeliveryId = deliveryId;
        Id = webhook.Id;
        Url = webhook.Url;
        Name = webhook.Name;
        Secret = webhook.Secret;
        Headers = webhook.Headers;
        Events = events;
        Payload = payload;
    }
}