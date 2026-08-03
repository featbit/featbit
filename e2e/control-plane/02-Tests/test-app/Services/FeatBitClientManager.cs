using FeatBit.Sdk.Server;
using FeatBit.Sdk.Server.Model;
using FeatBit.Sdk.Server.Options;

namespace FeatBit.TestApp.Services;

public sealed class FeatBitClientManager : IDisposable
{
    private readonly object _lock = new();
    private readonly EventTracker _eventTracker;
    private readonly ILogger<FeatBitClientManager> _logger;
    private readonly string _instanceId;
    private readonly string _envSecret;
    private readonly string _evalUrl;
    private readonly string _streamingUrl;
    private readonly string[] _flagKeys;

    private FbClient? _client;
    private CancellationTokenSource? _pollCts;
    private Task? _pollTask;
    private Dictionary<string, bool> _lastFlagValues = new();

    public bool IsConnected { get; private set; }
    public string ConnectionState { get; private set; } = "Disconnected";
    public DateTime? ConnectedAt { get; private set; }
    public DateTime? DisconnectedAt { get; private set; }
    public Dictionary<string, FlagSnapshot> FlagEvaluations { get; } = new();

    public sealed class FlagSnapshot
    {
        public bool Value { get; set; }
        public DateTime EvaluatedAt { get; set; }
    }

    public FeatBitClientManager(
        IConfiguration configuration,
        EventTracker eventTracker,
        ILogger<FeatBitClientManager> logger)
    {
        _eventTracker = eventTracker;
        _logger = logger;

        _instanceId = configuration["INSTANCE_ID"] ?? "default";
        _envSecret = configuration["FEATBIT_ENV_SECRET"]
            ?? throw new InvalidOperationException("FEATBIT_ENV_SECRET is required");
        _evalUrl = configuration["FEATBIT_EVAL_URL"]
            ?? throw new InvalidOperationException("FEATBIT_EVAL_URL is required");

        _streamingUrl = configuration["FEATBIT_STREAMING_URL"]
            ?? DeriveStreamingUrl(_evalUrl);

        var flagKeysRaw = configuration["FLAG_KEYS"] ?? string.Empty;
        _flagKeys = flagKeysRaw
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        logger.LogInformation(
            "FeatBitClientManager configured — Instance={InstanceId}, EvalUrl={EvalUrl}, StreamingUrl={StreamingUrl}, Secret={SecretPrefix}..., Flags=[{FlagKeys}]",
            _instanceId, _evalUrl, _streamingUrl,
            _envSecret.Length > 12 ? _envSecret[..12] : _envSecret,
            string.Join(",", _flagKeys));
    }

    public string InstanceId => _instanceId;
    public string EvalServerEndpoint => _streamingUrl;

    public async Task<bool> ConnectAsync(TimeSpan? timeout = null)
    {
        lock (_lock)
        {
            if (IsConnected)
                throw new InvalidOperationException("Already connected");

            ConnectionState = "Connecting";
        }

        timeout ??= TimeSpan.FromSeconds(30);

        try
        {
            var options = new FbOptionsBuilder(_envSecret)
                .Event(new Uri(_evalUrl))
                .Streaming(new Uri(_streamingUrl))
                .Build();

            var client = new FbClient(options);

            // Wait for initialization with timeout
            var deadline = DateTime.UtcNow + timeout.Value;
            while (!client.Initialized && DateTime.UtcNow < deadline)
            {
                await Task.Delay(100);
            }

            lock (_lock)
            {
                _client = client;
                IsConnected = client.Initialized;
                ConnectionState = client.Initialized ? "Connected" : "Failed";
                ConnectedAt = client.Initialized ? DateTime.UtcNow : null;
                DisconnectedAt = null;
            }

            if (client.Initialized)
            {
                _eventTracker.RecordEvent("connected");
                EvaluateAllFlags();
                StartFlagPolling();

                _logger.LogInformation("FbClient connected for instance {InstanceId}", _instanceId);
            }
            else
            {
                _eventTracker.RecordEvent("connection-failed");
                _logger.LogWarning("FbClient failed to initialize for instance {InstanceId}", _instanceId);
                _logger.LogWarning(
                    "SDK init details — EvalUrl={EvalUrl}, StreamingUrl={StreamingUrl}, SecretLen={SecretLen}",
                    _evalUrl, _streamingUrl, _envSecret.Length);
            }

            return client.Initialized;
        }
        catch (Exception ex)
        {
            lock (_lock)
            {
                ConnectionState = "Failed";
                IsConnected = false;
            }

            _eventTracker.RecordEvent("connection-failed", new Dictionary<string, object>
            {
                ["error"] = ex.Message
            });

            _logger.LogError(ex, "Failed to connect FbClient for instance {InstanceId}", _instanceId);
            return false;
        }
    }

    public async Task DisconnectAsync()
    {
        FbClient? client;

        lock (_lock)
        {
            if (!IsConnected || _client is null)
                throw new InvalidOperationException("Not connected");

            client = _client;
        }

        StopFlagPolling();

        await client.CloseAsync();

        lock (_lock)
        {
            _client = null;
            IsConnected = false;
            ConnectionState = "Disconnected";
            DisconnectedAt = DateTime.UtcNow;
        }

        _eventTracker.RecordEvent("disconnected");
        _logger.LogInformation("FbClient disconnected for instance {InstanceId}", _instanceId);
    }

    private void EvaluateAllFlags()
    {
        var client = _client;
        if (client is null || !client.Initialized) return;

        var user = FbUser.Builder("test-app-evaluator").Name("test-app").Build();

        lock (FlagEvaluations)
        {
            foreach (var key in _flagKeys)
            {
                var value = client.BoolVariation(key, user, defaultValue: false);
                FlagEvaluations[key] = new FlagSnapshot
                {
                    Value = value,
                    EvaluatedAt = DateTime.UtcNow
                };
            }
        }
    }

    private void StartFlagPolling()
    {
        _pollCts = new CancellationTokenSource();
        var token = _pollCts.Token;

        _pollTask = Task.Run(async () =>
        {
            // Capture initial values
            lock (FlagEvaluations)
            {
                foreach (var kvp in FlagEvaluations)
                {
                    _lastFlagValues[kvp.Key] = kvp.Value.Value;
                }
            }

            while (!token.IsCancellationRequested)
            {
                await Task.Delay(1000, token).ConfigureAwait(false);

                try
                {
                    var client = _client;
                    if (client is null || !client.Initialized) continue;

                    var user = FbUser.Builder("test-app-evaluator").Name("test-app").Build();
                    var changedCount = 0;

                    lock (FlagEvaluations)
                    {
                        foreach (var key in _flagKeys)
                        {
                            var value = client.BoolVariation(key, user, defaultValue: false);
                            var hadPrevious = _lastFlagValues.TryGetValue(key, out var previous);

                            FlagEvaluations[key] = new FlagSnapshot
                            {
                                Value = value,
                                EvaluatedAt = DateTime.UtcNow
                            };

                            if (hadPrevious && previous != value)
                            {
                                changedCount++;
                            }

                            _lastFlagValues[key] = value;
                        }
                    }

                    if (changedCount > 0)
                    {
                        _eventTracker.RecordEvent("data-sync", new Dictionary<string, object>
                        {
                            ["eventType"] = "full",
                            ["flagCount"] = _flagKeys.Length
                        });

                        _logger.LogInformation(
                            "Detected {Count} flag value changes — recorded data-sync event",
                            changedCount);
                    }
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Error during flag polling");
                }
            }
        }, token);
    }

    private void StopFlagPolling()
    {
        _pollCts?.Cancel();

        try
        {
            _pollTask?.Wait(TimeSpan.FromSeconds(5));
        }
        catch (AggregateException)
        {
            // Expected on cancellation
        }

        _pollCts?.Dispose();
        _pollCts = null;
        _pollTask = null;
    }

    public void Dispose()
    {
        StopFlagPolling();

        if (_client is not null)
        {
            _client.CloseAsync().GetAwaiter().GetResult();
            _client = null;
        }
    }

    private static string DeriveStreamingUrl(string evalUrl)
    {
        var uri = new Uri(evalUrl);
        var scheme = uri.Scheme == "https" ? "wss" : "ws";
        return $"{scheme}://{uri.Host}:{uri.Port}";
    }
}
