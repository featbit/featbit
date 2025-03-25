using System.Data;
using System.Threading.Channels;
using Dapper;
using Domain.Messages;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Infrastructure.MQ.Postgres;

internal record ChannelMessage(string Channel, long MessageId);

public partial class PostgresMessageConsumer : BackgroundService
{
    private readonly NpgsqlDataSource _dataSource;
    private readonly Dictionary<string, IMessageConsumer> _handlers;
    private readonly ILogger<PostgresMessageConsumer> _logger;

    private static readonly Channel<ChannelMessage> MessageChannel = Channel.CreateBounded<ChannelMessage>(
        new BoundedChannelOptions(1000)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleWriter = true,
            SingleReader = true
        }
    );

    private static readonly string[] ListeningTopics = [Topics.FeatureFlagChange, Topics.SegmentChange];
    private static readonly string[] ListeningChannels = ListeningTopics.Select(Topics.ToChannel).ToArray();
    private static readonly string ListenChannelsSql = string.Join(' ', ListeningChannels.Select(x => $"LISTEN {x};"));

    // The interval in seconds to wait before restarting the listen task after connection closed.
    private const int RestartIntervalInSeconds = 5;

    // The number of seconds of connection inactivity before Npgsql sends a keepalive query.
    private const int KeepAliveIntervalInSeconds = 15;

    // The cancellation token source for the listen task
    private CancellationTokenSource _listenCts = new();

    // The connection being used to listen for notifications, we record it so we can dispose it when reconnecting
    private NpgsqlConnection? _connection;

    // The time when the connection was closed
    private DateTime? _connectionClosedAt;

    // The message id of the last message consumed
    private long _lastMessageId = -1;

    // The time when we start the listen task
    private DateTime? _startedAt;

    private const string FetchMissedMessagesSql =
        """
        select id, topic
        from queue_messages
        where not_visible_until is null
          and topic = any (@Topics)
          and status = 'Notified'
          and (
            (@LastMessageId = -1 and enqueued_at > @LastEnqueuedAt) or
            (@LastMessageId != -1 and id > @LastMessageId)
            )
        order by id;
        """;

    public PostgresMessageConsumer(
        IConfiguration configuration,
        IEnumerable<IMessageConsumer> handlers,
        ILogger<PostgresMessageConsumer> logger)
    {
        var builder = new NpgsqlConnectionStringBuilder(configuration["Postgres:ConnectionString"]!)
        {
            // override the default keepalive interval and application name
            KeepAlive = KeepAliveIntervalInSeconds,
            ApplicationName = "els_pg_msg_consumer_keep_alived"
        };
        _dataSource = NpgsqlDataSource.Create(builder.ConnectionString);

        _handlers = handlers.ToDictionary(x => Topics.ToChannel(x.Topic), x => x);
        _logger = logger;
    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var tasks = new[]
        {
            ListenAsync(stoppingToken),
            ConsumeAsync(stoppingToken)
        };

        return Task.WhenAll(tasks);
    }

    private async Task ListenAsync(CancellationToken stoppingToken)
    {
        _startedAt = DateTime.UtcNow;

        while (!stoppingToken.IsCancellationRequested)
        {
            var startError = false;

            try
            {
                var connection = await SetupConnectionAsync();

                // add missed messages if any
                await AddMissedMessagesAsync(connection);

                var cts = CancellationTokenSource.CreateLinkedTokenSource(_listenCts.Token, stoppingToken);

                await connection.ExecuteAsync(ListenChannelsSql, cts.Token);
                Log.StartListening(_logger, string.Join(',', ListeningChannels));

                while (!cts.IsCancellationRequested)
                {
                    try
                    {
                        Log.WaitNotification(_logger);
                        await connection.WaitAsync(cts.Token);
                    }
                    catch (OperationCanceledException)
                    {
                        // ignore
                    }
                    catch (Exception ex)
                    {
                        Log.ErrorWaitNotification(_logger, ex);
                    }
                }
            }
            catch (OperationCanceledException)
            {
                // ignore
            }
            catch (Exception ex)
            {
                startError = true;
                Log.ErrorStartListening(_logger, RestartIntervalInSeconds, ex);
            }

            // the listen task is stopped due to start error
            if (startError)
            {
                Log.ListenStoppedDueToStartError(_logger, RestartIntervalInSeconds);

                // wait for the restart interval
                await Task.Delay(TimeSpan.FromSeconds(RestartIntervalInSeconds), stoppingToken);
            }
            // the listen task is stopped due to connection closed
            else if (_listenCts.IsCancellationRequested)
            {
                Log.ListenStoppedDueToConnectionClosed(_logger, RestartIntervalInSeconds);

                // wait for the restart interval
                await Task.Delay(TimeSpan.FromSeconds(RestartIntervalInSeconds), stoppingToken);

                // reset the cancellation token source
                _listenCts.Dispose();
                _listenCts = new CancellationTokenSource();
            }

            // back to the beginning of the loop to restart the listen task
        }

        Log.ListeningStopped(_logger);
    }

    private async Task ConsumeAsync(CancellationToken stoppingToken)
    {
        await foreach (var message in MessageChannel.Reader.ReadAllAsync(stoppingToken))
        {
            var (channel, messageId) = message;

            try
            {
                await ConsumeCoreAsync(channel, messageId);
                Log.MessageHandled(_logger, messageId);

                _lastMessageId = messageId;
            }
            catch (Exception ex)
            {
                Log.ErrorConsumeMessage(_logger, channel, ex);
            }
        }

        return;

        async Task ConsumeCoreAsync(string channel, long messageId)
        {
            if (!_handlers.TryGetValue(channel, out var handler))
            {
                Log.NoHandlerForChannel(_logger, channel);
                return;
            }

            await using var connection = await _dataSource.OpenConnectionAsync(stoppingToken);
            var payload = await connection.QueryFirstOrDefaultAsync<string>(
                "select payload from queue_messages where id = @Id", new { Id = messageId }
            );

            if (string.IsNullOrWhiteSpace(payload))
            {
                return;
            }

            await handler.HandleAsync(payload, stoppingToken);
        }
    }

    private async Task<NpgsqlConnection> SetupConnectionAsync()
    {
        // dispose existing connection
        if (_connection != null)
        {
            _connection.StateChange -= OnConnectionStateChanged;
            _connection.Notification -= OnNotificationReceived;

            try
            {
                await _connection.DisposeAsync();
                Log.ConnectionDisposed(_logger);
            }
            catch (Exception ex)
            {
                Log.ErrorDisposeConnection(_logger, ex);
            }

            _connection = null;
        }

        var connection = await _dataSource.OpenConnectionAsync();
        connection.StateChange += OnConnectionStateChanged;
        connection.Notification += OnNotificationReceived;

        // record the connection
        _connection = connection;

        return connection;
    }

    private void OnConnectionStateChanged(object sender, StateChangeEventArgs args)
    {
        // This event occurs when the state of the connection changes from closed to opened or from opened to closed.

        // connection state changed from opened to closed
        if (args.CurrentState == ConnectionState.Closed)
        {
            // Why subtract KeepAliveInterval?
            // Because we suppose the connection is closed at the time of the last successful keepalive query.
            // This way, we won't miss any notifications that were sent after the last keepalive query
            // but may consume some duplicate notifications.
            _connectionClosedAt = DateTime.UtcNow.Subtract(TimeSpan.FromSeconds(KeepAliveIntervalInSeconds));

            Log.ConnectionStateChanged(
                _logger,
                Enum.GetName(args.OriginalState)!,
                Enum.GetName(args.CurrentState)!
            );

            // cancel current listen task
            _listenCts.Cancel();
        }
    }

    private void OnNotificationReceived(object sender, NpgsqlNotificationEventArgs args)
    {
        if (string.IsNullOrWhiteSpace(args.Payload) || !long.TryParse(args.Payload, out var messageId))
        {
            Log.InvalidMessageReceived(_logger, args.Payload);
            return;
        }

        Log.NotificationReceived(
            _logger,
            args.Channel,
            args.PID,
            args.Payload
        );

        MessageChannel.Writer.TryWrite(new ChannelMessage(args.Channel, messageId));
    }

    private async Task AddMissedMessagesAsync(NpgsqlConnection connection)
    {
        try
        {
            // if the connection is closed, use the connection closed time;
            // otherwise, use the time when the listen task started
            var lastEnqueuedAt = _connectionClosedAt ?? _startedAt;

            var missingMessages = await connection.QueryAsync<(long id, string topic)>(
                FetchMissedMessagesSql, new
                {
                    Topics = ListeningTopics,
                    LastMessageId = _lastMessageId,
                    LastEnqueuedAt = lastEnqueuedAt
                }
            );

            foreach (var message in missingMessages)
            {
                var channelMessage = new ChannelMessage(Topics.ToChannel(message.topic), message.id);
                MessageChannel.Writer.TryWrite(channelMessage);
            }
        }
        catch (Exception ex)
        {
            Log.ErrorAddMissedMessages(_logger, ex);
        }
    }
}