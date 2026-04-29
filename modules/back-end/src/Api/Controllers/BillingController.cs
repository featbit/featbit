using System.Text.Json;
using Application.Billing;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/billing")]
public class BillingController : ApiControllerBase
{
    [HttpGet("subscription")]
    public async Task<ApiResponse<string>> GetSubscriptionAsync()
    {
        var request = new GetSubscription
        {
            WorkspaceId = WorkspaceId
        };

        var subscription = await Mediator.Send(request);
        return Ok(subscription);
    }

    [HttpPost("subscription")]
    public async Task<ApiResponse<string>> CreateSubscriptionAsync(CreateSubscription request)
    {
        request.WorkspaceId = WorkspaceId;

        var session = await Mediator.Send(request);
        return Ok(session);
    }

    [HttpPut("subscription/upgrade")]
    public async Task<ApiResponse<bool>> UpgradeSubscriptionAsync(UpgradeSubscription request)
    {
        request.WorkspaceId = WorkspaceId;

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [HttpPut("subscription/downgrade")]
    public async Task<ApiResponse<bool>> DowngradeSubscriptionAsync(DowngradeSubscription request)
    {
        request.WorkspaceId = WorkspaceId;

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [HttpGet("billing-information")]
    public async Task<ApiResponse<string>> GetBillingInformationAsync()
    {
        var request = new GetBillingInformation
        {
            WorkspaceId = WorkspaceId
        };

        var billingInformation = await Mediator.Send(request);
        return Ok(billingInformation);
    }

    [HttpPut("billing-information")]
    public async Task<ApiResponse<bool>> UpdateBillingInformationAsync(JsonElement billingInformation)
    {
        var request = new UpdateBillingInformation
        {
            WorkspaceId = WorkspaceId,
            Payload = billingInformation.GetRawText()
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [HttpGet("invoices")]
    public async Task<ApiResponse<string>> GetInvoicesAsync(Guid workspaceId)
    {
        var request = new GetInvoices
        {
            WorkspaceId = WorkspaceId
        };

        var invoices = await Mediator.Send(request);
        return Ok(invoices);
    }
}