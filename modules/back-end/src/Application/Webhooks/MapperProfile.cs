using Application.Bases.Models;
using Domain.Webhooks;

namespace Application.Webhooks;

public class MapperProfile : Profile
{
    public MapperProfile()
    {
        CreateMap<Webhook, WebhookVm>();
        CreateMap<PagedResult<Webhook>, PagedResult<WebhookVm>>();
    }
}