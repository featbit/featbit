using Domain.Messages;

namespace Infrastructure.MQ;

public class ClientConnectionMadeHandler : IMessageConsumer
{
    public string Topic => Topics.ConnectionMade;

    public async Task HandleAsync(string message, CancellationToken cancellationToken)
    {
        Console.WriteLine($"Handling connection made message: {message}");
    }
}
