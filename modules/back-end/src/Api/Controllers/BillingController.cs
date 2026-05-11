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

    [HttpGet("current-cycle")]
    public async Task<ApiResponse<string>> GetCurrentCycleAsync()
    {
        var request = new GetCurrentCycle
        {
            WorkspaceId = WorkspaceId
        };

        var currentCycle = await Mediator.Send(request);
        return Ok(currentCycle);
    }

    [HttpGet("license")]
    public async Task<ApiResponse<string>> GetLicenseAsync()
    {
        var request = new GetLicense
        {
            WorkspaceId = WorkspaceId
        };

        var license = await Mediator.Send(request);
        return Ok(license);
    }

    [HttpPost("subscription")]
    public async Task<ApiResponse<string>> CreateSubscriptionAsync(CreateSubscription request)
    {
        request.WorkspaceId = WorkspaceId;

        var session = await Mediator.Send(request);
        return Ok(session);
    }

    [HttpPost("subscription/upgrade")]
    public async Task<ApiResponse<string>> UpgradeSubscriptionAsync(UpgradeSubscription request)
    {
        request.WorkspaceId = WorkspaceId;

        var response = await Mediator.Send(request);
        return Ok(response);
    }

    [HttpPost("subscription/proration-preview")]
    public async Task<ApiResponse<string>> GetProrationPreviewAsync(GetProrationPreview request)
    {
        request.WorkspaceId = WorkspaceId;

        var preview = await Mediator.Send(request);
        return Ok(preview);
    }

    [HttpPost("subscription/downgrade")]
    public async Task<ApiResponse<string>> DowngradeSubscriptionAsync(DowngradeSubscription request)
    {
        request.WorkspaceId = WorkspaceId;

        var response = await Mediator.Send(request);
        return Ok(response);
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