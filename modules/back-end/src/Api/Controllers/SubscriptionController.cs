using Application.Subscription;
using Domain.Workspaces;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/subscriptions")]
public class SubscriptionController : ApiControllerBase
{
    [HttpPost]
    [Route("checkout")]
    public async Task<ApiResponse<CheckoutSessionVm>> CreateCheckoutSessionAsync(CreateCheckoutSession request)
    {
        // TODO replace with real values
        request.Email = "lian.yang.work@gmail.com";
        request.WorkspaceId = WorkspaceId;
        request.Plan = Plan.Pro;
        request.Interval = Interval.Month;
        request.Mau = 10000;
        request.ExtraFeatures = new[] { LicenseFeatures.FineGrainedAccessControl };
        
        var result = await Mediator.Send(request);
        return Ok(result);
    }
}
