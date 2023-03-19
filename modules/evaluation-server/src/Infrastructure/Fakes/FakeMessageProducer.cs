using System.Text.Json;
using Domain.Core;

namespace Infrastructure.Fakes;

public class FakeMessageProducer : IMqMessageProducer
{
    public Task PublishAsync<TMessage>(string topic, TMessage? message) where TMessage : class
    {
        if (message == null)
        {
            // ignore null message
            return Task.CompletedTask;
        }

        _ = JsonSerializer.Serialize(message, ReusableJsonSerializerOptions.Web);
        return Task.CompletedTask;
    }
}