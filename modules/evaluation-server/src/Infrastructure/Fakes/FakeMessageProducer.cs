using System.Text.Json;
using Domain.Messages;
using Domain.Shared;

namespace Infrastructure.Fakes;

public class FakeMessageProducer : IMessageProducer
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