using System.Threading.Channels;
using Dapper;
using Domain.Messages;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Infrastructure.MQ.Postgres;

public partial class PostgresMessageConsumer : BackgroundService
{
    private readonly NpgsqlDataSource _dataSource;
    private readonly Dictionary<string, IMessageConsumer> _handlers;
    private readonly ILogger<PostgresMessageConsumer> _logger;
    private readonly string[] _listeningTopics;
    private readonly string _listenChannelsSql;

    // Notifications only wake the durable scan. Coalescing wake-ups cannot discard messages.
    private readonly Channel<bool> _wake = Channel.CreateBounded<bool>(new BoundedChannelOptions(1)
    {
        FullMode = BoundedChannelFullMode.DropWrite,
        SingleReader = true
    });
    private readonly HashSet<long> _handled = [];
    private static readonly TimeSpan RescanInterval = TimeSpan.FromSeconds(5);
    private const int RestartIntervalInSeconds = 5;
    private const string RetainedMessagesSql = """
        select id, topic from queue_messages
        where not_visible_until is null and topic = any (@Topics) and status = 'Notified'
        order by id;
        """;

    public PostgresMessageConsumer(
        IConfiguration configuration,
        IEnumerable<IMessageConsumer> handlers,
        ILogger<PostgresMessageConsumer> logger)
    {
        var builder = new NpgsqlConnectionStringBuilder(configuration.GetPostgresConnectionString())
        {
            KeepAlive = 15,
            ApplicationName = "els_pg_msg_consumer_keep_alived"
        };
        _dataSource = NpgsqlDataSource.Create(builder.ConnectionString);
        _listeningTopics = configuration.UseControlPlane()
            ? [Topics.FeatureFlagChange, Topics.SegmentChange, Topics.ControlPlaneCommand]
            : [Topics.FeatureFlagChange, Topics.SegmentChange];
        _listenChannelsSql = string.Join(' ', _listeningTopics.Select(x => $"LISTEN {Topics.ToChannel(x)};"));
        _handlers = handlers.ToDictionary(x => x.Topic);
        _logger = logger;
    }

    public override async Task StartAsync(CancellationToken cancellationToken)
    {
        // Establish the baseline before the host accepts SDK connections. Old notifications
        // must not replay stale values to new connections, which obtain a full initial sync.
        while (true)
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken);
                var existing = await connection.QueryAsync<(long Id, string Topic)>(
                    new CommandDefinition(RetainedMessagesSql, new { Topics = _listeningTopics },
                        cancellationToken: cancellationToken));
                _handled.UnionWith(existing.Select(x => x.Id));
                break;
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
            catch (Exception ex)
            {
                Log.ErrorStartListening(_logger, RestartIntervalInSeconds, ex);
                await Task.Delay(RescanInterval, cancellationToken);
            }
        }
        await base.StartAsync(cancellationToken);
    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken) =>
        Task.WhenAll(ListenAsync(stoppingToken), ConsumeAsync(stoppingToken));

    private async Task ListenAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var connection = await _dataSource.OpenConnectionAsync(stoppingToken);
                connection.Notification += OnNotificationReceived;
                // Subscribe before waking the scan, closing the reconnect scan/LISTEN gap.
                await connection.ExecuteAsync(new CommandDefinition(_listenChannelsSql,
                    cancellationToken: stoppingToken));
                _wake.Writer.TryWrite(true);
                Log.StartListening(_logger, string.Join(',', _listeningTopics.Select(Topics.ToChannel)));
                while (!stoppingToken.IsCancellationRequested)
                    await connection.WaitAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex)
            {
                Log.ErrorStartListening(_logger, RestartIntervalInSeconds, ex);
                try { await Task.Delay(RescanInterval, stoppingToken); }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            }
        }
        Log.ListeningStopped(_logger);
    }

    private void OnNotificationReceived(object sender, NpgsqlNotificationEventArgs args)
    {
        Log.NotificationReceived(_logger, args.Channel, args.PID, args.Payload);
        _wake.Writer.TryWrite(true);
    }

    private async Task ConsumeAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ScanAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { Log.ErrorConsumeMessage(_logger, "durable notification scan", ex); }

            // A periodic scan also repairs an insert followed by failed/missing pg_notify.
            using var wait = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
            wait.CancelAfter(RescanInterval);
            try { await _wake.Reader.ReadAsync(wait.Token); }
            catch (OperationCanceledException) when (!stoppingToken.IsCancellationRequested) { }
            catch (OperationCanceledException) { break; }
        }
    }

    private async Task ScanAsync(CancellationToken cancellationToken)
    {
        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken);
        var messages = (await connection.QueryAsync<(long Id, string Topic)>(
            new CommandDefinition(RetainedMessagesSql, new { Topics = _listeningTopics },
                cancellationToken: cancellationToken))).AsList();
        // Queue retention bounds the per-process receipts. Never use an id/timestamp cursor:
        // PostgreSQL can commit a smaller id after a larger id has already been delivered.
        _handled.IntersectWith(messages.Select(x => x.Id));
        foreach (var (id, topic) in messages)
        {
            if (_handled.Contains(id)) continue;
            if (_handlers.TryGetValue(topic, out var handler))
            {
                var payload = await connection.QueryFirstOrDefaultAsync<string>(new CommandDefinition(
                    "select payload from queue_messages where id = @Id", new { Id = id },
                    cancellationToken: cancellationToken));
                if (!string.IsNullOrWhiteSpace(payload))
                    await handler.HandleAsync(payload, cancellationToken);
            }
            // A failed handler exits the scan before recording this id or handling later ids.
            _handled.Add(id);
            Log.MessageHandled(_logger, id);
        }
    }

    public override void Dispose()
    {
        base.Dispose();
        _dataSource.Dispose();
    }
}
