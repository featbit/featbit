using Application.Checkout;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/checkout")]
public class CheckoutController : ApiControllerBase
{
    [HttpPost]
    [Route("session")]
    public async Task<ApiResponse<CheckoutSessionVm>> CreateSessionAsync(CreateCheckoutSession request)
    {
        request.Amount = 1399;
        request.Currency = "USD";
        
        var result = await Mediator.Send(request);
        return Ok(result);
    }
}
