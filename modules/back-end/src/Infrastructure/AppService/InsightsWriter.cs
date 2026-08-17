using System.Threading.Channels;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.AppService;

public sealed class InsightsWriter : BackgroundService
{
    private static readonly TimeSpan DefaultFlushInterval = TimeSpan.FromSeconds(1);
    private const int DefaultChannelCapacity = 10_000;
    private const int DefaultMaxBatchSize = 1_000;

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<InsightsWriter> _logger;
    private readonly Channel<object> _channel;
    private readonly TimeSpan _flushInterval;
    private readonly int _maxBatchSize;

    public InsightsWriter(IServiceScopeFactory scopeFactory, ILogger<InsightsWriter> logger)
        : this(scopeFactory, logger, DefaultFlushInterval, DefaultChannelCapacity, DefaultMaxBatchSize)
    {
    }

    internal InsightsWriter(
        IServiceScopeFactory scopeFactory,
        ILogger<InsightsWriter> logger,
        TimeSpan flushInterval,
        int channelCapacity,
        int maxBatchSize)
    {
        ArgumentOutOfRangeException.ThrowIfLessThanOrEqual(flushInterval, TimeSpan.Zero);
        ArgumentOutOfRangeException.ThrowIfLessThanOrEqual(channelCapacity, 0);
        ArgumentOutOfRangeException.ThrowIfLessThanOrEqual(maxBatchSize, 0);

        _scopeFactory = scopeFactory;
        _logger = logger;
        _flushInterval = flushInterval;
        _maxBatchSize = maxBatchSize;

        _channel = Channel.CreateBounded<object>(
            new BoundedChannelOptions(channelCapacity)
            {
                FullMode = BoundedChannelFullMode.Wait,
                SingleReader = true,
                SingleWriter = false
            }
        );
    }

    public ValueTask RecordAsync(object insight, CancellationToken cancellationToken = default)
        => _channel.Writer.WriteAsync(insight, cancellationToken);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Start flushing insight loop...");

        try
        {
            while (await _channel.Reader.WaitToReadAsync(stoppingToken))
            {
                var batch = await ReadBatchAsync(stoppingToken);
                if (batch.Length > 0)
                {
                    await PersistBatchAsync(batch);
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // The host is stopping. The remaining insights are flushed below.
        }
        finally
        {
            await FlushRemainingAsync();

            _logger.LogInformation("Insights writer stopped...");
        }
    }

    private async Task<object[]> ReadBatchAsync(CancellationToken stoppingToken)
    {
        var batch = new List<object>(_maxBatchSize);
        DrainInto(batch);

        if (batch.Count == _maxBatchSize)
        {
            return batch.ToArray();
        }

        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
        timeout.CancelAfter(_flushInterval);

        while (batch.Count < _maxBatchSize)
        {
            try
            {
                if (!await _channel.Reader.WaitToReadAsync(timeout.Token))
                {
                    break;
                }
            }
            catch (OperationCanceledException) when (timeout.IsCancellationRequested)
            {
                break;
            }

            DrainInto(batch);
        }

        return batch.ToArray();
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        _channel.Writer.TryComplete();

        if (ExecuteTask != null)
        {
            await ExecuteTask.WaitAsync(cancellationToken);
        }
    }

    private async Task FlushRemainingAsync()
    {
        while (DrainBatch() is { Length: > 0 } batch)
        {
            await PersistBatchAsync(batch);
        }
    }

    private async Task PersistBatchAsync(object[] batch)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();

            var insightService = scope.ServiceProvider.GetRequiredService<IInsightService>();
            await insightService.AddManyAsync(batch);

            if (_logger.IsEnabled(LogLevel.Debug))
            {
                _logger.LogDebug("{Count} insight events have been handled.", batch.Length);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Failed to flush {Count} insight events.",
                batch.Length
            );
        }
    }

    private object[] DrainBatch()
    {
        var batch = new List<object>(_maxBatchSize);

        DrainInto(batch);

        return batch.ToArray();
    }

    private void DrainInto(List<object> batch)
    {
        while (batch.Count < _maxBatchSize && _channel.Reader.TryRead(out var insight))
        {
            batch.Add(insight);
        }
    }
}
