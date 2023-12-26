using Application.Bases.Models;

namespace Application.Webhooks;

public class WebhookDeliveryFilter : PagedRequest
{
    public string Event { get; set; }

    public bool? Success { get; set; }

    public DateTime? NotBefore { get; set; }
}