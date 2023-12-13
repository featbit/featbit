using Domain.Webhooks;
using HandlebarsDotNet;

namespace Infrastructure.Webhooks;

public class WebhookSender : IWebhookSender
{
    private readonly HttpClient _client;

    public WebhookSender(HttpClient client)
    {
        _client = client;
    }

    public async Task SendAsync(Webhook webhook, object payloadData)
    {
        var template = Handlebars.Compile(webhook.PayloadTemplate);
        var payload = template(payloadData);

        Console.WriteLine("The payload is {0}", payload);

        // 2. encrypt body using secret if user provided
        // 3. send http post request, if failed retry up to 3 times, the timeout is 10s for each try, write send log for each send
        // 4. write send log

        await Task.CompletedTask;
    }
}