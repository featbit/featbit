namespace Domain.Webhooks;

public class LastDelivery
{
    public bool Success { get; set; }

    public DateTime HappenedAt { get; set; }

    public int? Response { get; set; }

    public LastDelivery(WebhookDelivery delivery)
    {
        Success = delivery.Success;
        HappenedAt = delivery.StartedAt;
        Response = delivery.Response == null ? null : ((dynamic)delivery.Response).statusCode;
    }
}