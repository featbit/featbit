using Application.Bases.Models;

namespace Application.Webhooks;

public class GetWebhookList : IRequest<PagedResult<WebhookVm>>
{
    public Guid OrgId { get; set; }

    public WebhookFilter Filter { get; set; }
}

public class GetWebhookListHandler : IRequestHandler<GetWebhookList, PagedResult<WebhookVm>>
{
    private readonly IWebhookService _webhookService;
    private readonly IMapper _mapper;

    public GetWebhookListHandler(IWebhookService webhookService, IMapper mapper)
    {
        _webhookService = webhookService;
        _mapper = mapper;
    }

    public async Task<PagedResult<WebhookVm>> Handle(GetWebhookList request, CancellationToken cancellationToken)
    {
        var webhooks =
            await _webhookService.GetListAsync(request.OrgId, request.Filter);

        var webhookVms = _mapper.Map<PagedResult<WebhookVm>>(webhooks);
        return webhookVms;
    }
}