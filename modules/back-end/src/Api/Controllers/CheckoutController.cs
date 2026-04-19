using Application.Checkout;

namespace Api.Controllers;

public class CheckoutController : ApiControllerBase
{
    [HttpPost]
    [Route("session")]
    public async Task<ApiResponse<CheckoutSessionVm>> CreateSessionAsync(CreateCheckoutSession request)
    {
        var result = await Mediator.Send(request);
        return Ok(result);
    }
}
