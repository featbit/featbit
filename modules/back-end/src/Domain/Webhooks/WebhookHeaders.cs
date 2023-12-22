namespace Domain.Webhooks;

public static class WebhookHeaders
{
    /// <summary>
    /// A globally unique identifier (GUID) to identify the delivery
    /// </summary>
    public const string Delivery = "X-FeatBit-Delivery";

    /// <summary>
    /// The name of the event(s) that triggered the delivery. 
    /// </summary>
    public const string Event = "X-FeatBit-Event";

    /// <summary>
    /// The unique identifier of the webhook.
    /// </summary>
    public const string HookId = "X-FeatBit-Hook-ID";

    /// <summary>
    /// This header is sent if the webhook is configured with a secret. This is the HMAC hex digest of the request body, and is generated using the SHA-256 hash function and the secret as the HMAC key.
    /// </summary>
    public const string Signature = "X-FeatBit-Signature-256";
}