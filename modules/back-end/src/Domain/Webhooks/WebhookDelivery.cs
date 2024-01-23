using System.Net.Http.Headers;

namespace Domain.Webhooks;

public class WebhookDelivery : Entity
{
    public Guid WebhookId { get; set; }

    public bool Success { get; set; }

    public string Events { get; set; }

    public object Request { get; set; }

    public object Response { get; set; }

    public object Error { get; set; }

    public DateTime StartedAt { get; set; }

    public DateTime EndedAt { get; set; }

    public WebhookDelivery(Guid webhookId, string events)
    {
        WebhookId = webhookId;
        Events = events;
    }

    public void Started() => StartedAt = DateTime.UtcNow;

    public void AddRequest(string url, HttpRequestHeaders headers, string payload)
    {
        Request = new
        {
            url,
            headers = headers.ToDictionary(x => x.Key, x => string.Join("; ", x.Value)),
            payload
        };
    }

    public async Task AddResponseAsync(HttpResponseMessage response)
    {
        var statusCode = (int)response.StatusCode;
        var reasonPhrase = response.ReasonPhrase;
        var headers = response.Headers.ToDictionary(x => x.Key, x => string.Join("; ", x.Value));

        string body;
        try
        {
            body = await response.Content.ReadAsStringAsync();
        }
        catch (Exception)
        {
            body = string.Empty;
        }

        Success = response.IsSuccessStatusCode;
        Response = new { statusCode, reasonPhrase, headers, body };
    }

    public void Ended() => EndedAt = DateTime.UtcNow;

    public void SetError(object error)
    {
        Error = error;
        Success = false;
    }
}