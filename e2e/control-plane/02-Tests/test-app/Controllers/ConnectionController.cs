using FeatBit.TestApp.Models;
using FeatBit.TestApp.Services;
using Microsoft.AspNetCore.Mvc;

namespace FeatBit.TestApp.Controllers;

[ApiController]
[Route("api")]
public class ConnectionController : ControllerBase
{
    private readonly FeatBitClientManager _clientManager;

    public ConnectionController(FeatBitClientManager clientManager)
    {
        _clientManager = clientManager;
    }

    [HttpPost("connect")]
    public async Task<IActionResult> Connect([FromQuery] int? timeoutSeconds = null)
    {
        try
        {
            var timeout = timeoutSeconds.HasValue ? TimeSpan.FromSeconds(timeoutSeconds.Value) : (TimeSpan?)null;
            var connected = await _clientManager.ConnectAsync(timeout);

            return Ok(new ConnectResponse
            {
                InstanceId = _clientManager.InstanceId,
                Connected = connected,
                ConnectionTimestamp = DateTime.UtcNow.ToString("o")
            });
        }
        catch (InvalidOperationException)
        {
            return Conflict(new { error = "Already connected", instanceId = _clientManager.InstanceId });
        }
    }

    [HttpPost("disconnect")]
    public async Task<IActionResult> Disconnect()
    {
        try
        {
            await _clientManager.DisconnectAsync();

            return Ok(new DisconnectResponse
            {
                InstanceId = _clientManager.InstanceId,
                Disconnected = true,
                DisconnectionTimestamp = DateTime.UtcNow.ToString("o")
            });
        }
        catch (InvalidOperationException)
        {
            return BadRequest(new { error = "Not connected", instanceId = _clientManager.InstanceId });
        }
    }
}
