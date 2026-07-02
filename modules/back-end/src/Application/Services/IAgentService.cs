using System.Net;
using Application.RelayProxies;

namespace Application.Services;

public interface IAgentService
{
    Task<HttpStatusCode> CheckAvailabilityAsync(string host);

    Task<SyncResult> BootstrapAsync(string host, string key, object payload);
}