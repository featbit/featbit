using System.Net;

namespace Domain.Webhooks;

public class LastDelivery
{
    public bool Success => (int)Response >= 200 && (int)Response <= 299;

    public DateTime HappenedAt { get; set; }

    public HttpStatusCode Response { get; set; }

    public LastDelivery(HttpStatusCode response, DateTime happenedAt)
    {
        HappenedAt = happenedAt;
        Response = response;
    }
}