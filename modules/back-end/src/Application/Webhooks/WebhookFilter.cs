using Application.Bases.Models;

namespace Application.Webhooks;

public class WebhookFilter : PagedRequest
{
    public string Name { get; set; }
}