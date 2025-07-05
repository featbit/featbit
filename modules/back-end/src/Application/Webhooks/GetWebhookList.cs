using Application.Bases.Models;
using Application.Users;
using Domain.Organizations;

namespace Application.Webhooks;

public class GetWebhookList : IRequest<PagedResult<WebhookVm>>
{
    public Guid OrgId { get; set; }

    public WebhookFilter Filter { get; set; }
}

public class GetWebhookListHandler(
    IWebhookService webhookService,
    IUserService userService,
    IOrganizationService organizationService,
    IMapper mapper)
    : IRequestHandler<GetWebhookList, PagedResult<WebhookVm>>
{
    public async Task<PagedResult<WebhookVm>> Handle(GetWebhookList request, CancellationToken cancellationToken)
    {
        var webhooks =
            await webhookService.GetListAsync(request.OrgId, request.Filter);

        var creatorIds = webhooks.Items.Select(x => x.CreatorId);
        var creators = await userService.GetListAsync(creatorIds);

        var webhookVms = mapper.Map<PagedResult<WebhookVm>>(webhooks);
        foreach (var webhook in webhooks.Items)
        {
            var vm = webhookVms.Items.First(x => x.Id == webhook.Id);
            vm.Creator = mapper.Map<UserVm>(creators.FirstOrDefault(x => x.Id == webhook.CreatorId));

            var scopeStrings = vm.Scopes.Select(scope => new ScopeString(scope)).ToArray();
            vm.ScopeNames = await organizationService.GetScopesAsync(scopeStrings);
        }

        return webhookVms;
    }
}