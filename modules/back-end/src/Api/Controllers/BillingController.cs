using Application.Billing;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/billing")]
public class BillingController : ApiControllerBase
{
    [HttpPost]
    [Route("checkout")]
    public async Task<ApiResponse<CheckoutSession>> CreateCheckoutSessionAsync(CreateCheckoutSession request)
    {
        request.WorkspaceId = WorkspaceId;

        var result = await Mediator.Send(request);
        return Ok(result);
    }
}