using FeatBit.TestApp.Models;
using FeatBit.TestApp.Services;
using Microsoft.AspNetCore.Mvc;

namespace FeatBit.TestApp.Controllers;

[ApiController]
[Route("api")]
public class StatusController : ControllerBase
{
    private readonly FeatBitClientManager _clientManager;
    private readonly EventTracker _eventTracker;

    public StatusController(FeatBitClientManager clientManager, EventTracker eventTracker)
    {
        _clientManager = clientManager;
        _eventTracker = eventTracker;
    }

    [HttpGet("status")]
    public IActionResult GetStatus()
    {
        var dataSyncEvents = _eventTracker.GetDataSyncEvents();

        Dictionary<string, FlagEvaluation> flagEvals;
        lock (_clientManager.FlagEvaluations)
        {
            flagEvals = _clientManager.FlagEvaluations.ToDictionary(
                kvp => kvp.Key,
                kvp => new FlagEvaluation
                {
                    Value = kvp.Value.Value,
                    EvaluatedAt = kvp.Value.EvaluatedAt.ToString("o")
                });
        }

        return Ok(new StatusResponse
        {
            InstanceId = _clientManager.InstanceId,
            ConnectionState = _clientManager.ConnectionState,
            ConnectedAt = _clientManager.ConnectedAt?.ToString("o"),
            DisconnectedAt = _clientManager.DisconnectedAt?.ToString("o"),
            DataSyncEventsReceived = dataSyncEvents,
            DataSyncEventCount = dataSyncEvents.Count,
            FlagEvaluations = flagEvals,
            EvalServerEndpoint = _clientManager.EvalServerEndpoint
        });
    }

    [HttpGet("health")]
    public IActionResult Health()
    {
        return Ok(new { status = "healthy", instanceId = _clientManager.InstanceId });
    }

    [HttpGet("events")]
    public IActionResult GetEvents()
    {
        return Ok(new EventsResponse
        {
            Events = _eventTracker.GetEvents()
        });
    }
}
