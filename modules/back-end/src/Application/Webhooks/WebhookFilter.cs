using Application.Bases.Models;

namespace Application.Webhooks;

public class WebhookFilter : PagedRequest
{
    public string Name { get; set; }

    public string ProjectId { get; set; }

    public string EnvId { get; set; }
}