using System.Net;

namespace Application.Services;

public interface IAgentService
{
    Task<HttpStatusCode> CheckAvailabilityAsync(string host);

    Task BootstrapAsync(string host, string key, object payload);
}