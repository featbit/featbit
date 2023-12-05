using Application.Bases.Models;
using Application.Users;
using Domain.Organizations;

namespace Application.Webhooks;

public class GetWebhookList : IRequest<PagedResult<WebhookVm>>
{
    public Guid OrgId { get; set; }

    public WebhookFilter Filter { get; set; }
}

public class GetWebhookListHandler : IRequestHandler<GetWebhookList, PagedResult<WebhookVm>>
{
    private readonly IWebhookService _webhookService;
    private readonly IUserService _userService;
    private readonly IOrganizationService _organizationService;
    private readonly IMapper _mapper;

    public GetWebhookListHandler(
        IWebhookService webhookService,
        IUserService userService,
        IOrganizationService organizationService,
        IMapper mapper)
    {
        _webhookService = webhookService;
        _userService = userService;
        _organizationService = organizationService;
        _mapper = mapper;
    }

    public async Task<PagedResult<WebhookVm>> Handle(GetWebhookList request, CancellationToken cancellationToken)
    {
        var webhooks =
            await _webhookService.GetListAsync(request.OrgId, request.Filter);

        var creatorIds = webhooks.Items.Select(x => x.CreatorId);
        var creators = await _userService.GetListAsync(creatorIds);

        var webhookVms = _mapper.Map<PagedResult<WebhookVm>>(webhooks);
        foreach (var webhook in webhooks.Items)
        {
            var vm = webhookVms.Items.First(x => x.Id == webhook.Id);
            vm.Creator = _mapper.Map<UserVm>(creators.FirstOrDefault(x => x.Id == webhook.CreatorId));

            var scopeStrings = vm.Scopes.Select(scope => new ScopeString(scope)).ToArray();
            vm.ScopeNames = await _organizationService.GetScopesAsync(scopeStrings);
        }

        return webhookVms;
    }
}