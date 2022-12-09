using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Kafka;

public partial class FakeKafkaMessageConsumer : BackgroundService
{
    public FakeKafkaMessageConsumer(
        IConfiguration configuration,
        ILogger<FakeKafkaMessageConsumer> logger,
        IEnumerable<IKafkaMessageHandler> messageHandlers)
    {

    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        return Task.Factory.StartNew(
               async () => { await StartConsumerLoop(stoppingToken); },
               TaskCreationOptions.LongRunning
           );
    }

    private async Task StartConsumerLoop(CancellationToken cancellationToken)
    {
    }

    public override void Dispose()
    {
        base.Dispose();
    }
}