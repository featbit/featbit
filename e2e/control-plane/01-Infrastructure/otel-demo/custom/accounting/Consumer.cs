// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

using Confluent.Kafka;
using Microsoft.Extensions.Logging;
using Oteldemo;
using Microsoft.EntityFrameworkCore;
using System.Diagnostics;

namespace Accounting;

internal class DBContext : DbContext
{
    public DbSet<OrderEntity> Orders { get; set; }
    public DbSet<OrderItemEntity> CartItems { get; set; }
    public DbSet<ShippingEntity> Shipping { get; set; }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        var connectionString = Environment.GetEnvironmentVariable("DB_CONNECTION_STRING");

        optionsBuilder.UseNpgsql(connectionString).UseSnakeCaseNamingConvention();
    }
}


internal class Consumer : IDisposable
{
    private const string TopicName = "orders";

    private ILogger _logger;
    private IConsumer<string, byte[]> _consumer;
    private bool _isListening;
    private DBContext? _dbContext;
    private static readonly ActivitySource MyActivitySource = new("Accounting.Consumer");

    public Consumer(ILogger<Consumer> logger)
    {
        _logger = logger;

        var servers = Environment.GetEnvironmentVariable("KAFKA_ADDR")
            ?? throw new InvalidOperationException("The KAFKA_ADDR environment variable is not set.");

        _consumer = BuildConsumer(servers);
        _consumer.Subscribe(TopicName);

       if (_logger.IsEnabled(LogLevel.Information))
       {
           _logger.LogInformation("Connecting to Kafka: {servers}", servers);
       }

        _dbContext = Environment.GetEnvironmentVariable("DB_CONNECTION_STRING") == null ? null : new DBContext();
    }

    public void StartListening()
    {
        _isListening = true;

        try
        {
            while (_isListening)
            {
                try
                {
                    using var activity = MyActivitySource.StartActivity("order-consumed",  ActivityKind.Internal);
                    var consumeResult = _consumer.Consume();
                    ProcessMessage(consumeResult.Message);
                }
                catch (ConsumeException e)
                {
                    if (_logger.IsEnabled(LogLevel.Error))
                    {
                        _logger.LogError(e, "Consume error: {reason}", e.Error.Reason);
                    }
                }
            }
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("Closing consumer");

            _consumer.Close();
        }
    }

    private void ProcessMessage(Message<string, byte[]> message)
    {
        // Evaluate the FeatBit feature flags once per consumed order. All getters
        // return safe defaults when FeatBit is unconfigured or unreachable, so
        // this never blocks message consumption.
        var flags = FeatBitFlags.Instance;
        var ledgerPersistenceEnabled = flags.LedgerPersistenceEnabled();   // ops kill-switch (bool)
        var doubleEntryEnabled       = flags.DoubleEntryBookkeepingEnabled(); // release gate    (bool)
        var roundingStrategy         = flags.CurrencyRoundingStrategy();      // A/B experiment  (string)

        // Surface the flag values on the active OpenTelemetry span so flag-driven
        // behavior is visible in traces. "order-consumed" is the current activity
        // here (see StartListening), and Accounting.Consumer is exported via
        // OTEL_DOTNET_AUTO_TRACES_ADDITIONAL_SOURCES.
        var activity = Activity.Current;
        activity?.SetTag("feature_flag.featbit." + FeatBitFlags.FlagLedgerPersistenceEnabled, ledgerPersistenceEnabled);
        activity?.SetTag("feature_flag.featbit." + FeatBitFlags.FlagDoubleEntryBookkeeping, doubleEntryEnabled);
        activity?.SetTag("feature_flag.featbit." + FeatBitFlags.FlagCurrencyRounding, roundingStrategy);

        try
        {
            var order = OrderResult.Parser.ParseFrom(message.Value);
            Log.OrderReceivedMessage(_logger, order);

            // operational-ledger-persistence-enabled = false: ops kill-switch.
            // Still consume the message (offset already advances), but skip the
            // ledger write entirely. Safe degradation.
            if (!ledgerPersistenceEnabled)
            {
                activity?.SetTag("accounting.ledger.persisted", false);
                if (_logger.IsEnabled(LogLevel.Information))
                {
                    _logger.LogInformation(
                        "operational-ledger-persistence-enabled=false; skipping ledger write for order {OrderId}",
                        order.OrderId);
                }
                return;
            }

            // Apply the configured currency-rounding strategy to the ledger
            // amounts. RoundLedgerAmount THROWS on an unrecognized strategy value
            // (the intentional resiliency gap for a misconfigured experiment flag).
            decimal ledgerTotal = 0m;
            foreach (var item in order.Items)
            {
                ledgerTotal += RoundLedgerAmount(ToAmount(item.Cost), roundingStrategy);
            }
            ledgerTotal += RoundLedgerAmount(ToAmount(order.ShippingCost), roundingStrategy);
            activity?.SetTag("accounting.ledger.total_rounded", (double)ledgerTotal);

            // release-double-entry-bookkeeping = true: run the new balanced
            // debit/credit code path. Safe — it only records balancing metadata.
            if (doubleEntryEnabled)
            {
                activity?.SetTag("accounting.bookkeeping.mode", "double-entry");
                activity?.SetTag("accounting.bookkeeping.debit", (double)ledgerTotal);
                activity?.SetTag("accounting.bookkeeping.credit", (double)ledgerTotal);
            }
            else
            {
                activity?.SetTag("accounting.bookkeeping.mode", "single-entry");
            }

            if (_dbContext == null)
            {
                activity?.SetTag("accounting.ledger.persisted", false);
                return;
            }

            var orderEntity = new OrderEntity
            {
                Id = order.OrderId
            };
            _dbContext.Add(orderEntity);
            foreach (var item in order.Items)
            {
                var orderItem = new OrderItemEntity
                {
                    ItemCostCurrencyCode = item.Cost.CurrencyCode,
                    ItemCostUnits = item.Cost.Units,
                    ItemCostNanos = item.Cost.Nanos,
                    ProductId = item.Item.ProductId,
                    Quantity = item.Item.Quantity,
                    OrderId = order.OrderId
                };

                _dbContext.Add(orderItem);
            }

            var shipping = new ShippingEntity
            {
                ShippingTrackingId = order.ShippingTrackingId,
                ShippingCostCurrencyCode = order.ShippingCost.CurrencyCode,
                ShippingCostUnits = order.ShippingCost.Units,
                ShippingCostNanos = order.ShippingCost.Nanos,
                StreetAddress = order.ShippingAddress.StreetAddress,
                City = order.ShippingAddress.City,
                State = order.ShippingAddress.State,
                Country = order.ShippingAddress.Country,
                ZipCode = order.ShippingAddress.ZipCode,
                OrderId = order.OrderId
            };
            _dbContext.Add(shipping);
            _dbContext.SaveChanges();
            activity?.SetTag("accounting.ledger.persisted", true);
        }
        catch (Exception ex)
        {
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            _logger.LogError(ex, "Order parsing failed:");
        }
    }

    // Convert a protobuf Money (units + nanos) to a decimal amount.
    private static decimal ToAmount(Money money)
        => money.Units + (money.Nanos / 1_000_000_000m);

    // Apply the experiment-currency-rounding strategy to a ledger amount.
    //
    // This is a switch expression with NO default arm on purpose: an unrecognized
    // experiment-currency-rounding value (e.g. a typo or an unintended A/B bucket)
    // throws System.Runtime.CompilerServices.SwitchExpressionException at runtime.
    // That deliberate gap demonstrates how a misconfigured-but-present flag value
    // breaks ledger amount processing (vs. flag-absent / server-down, which the
    // getters absorb via safe defaults). "bankers" and the other known strategies
    // are safe.
    //
    // CS8509 (non-exhaustive switch) is suppressed deliberately: we WANT the
    // build to succeed and the unmatched case to throw at RUNTIME, not be turned
    // into a compile error by TreatWarningsAsErrors in Release. The implicit
    // unmatched arm still throws SwitchExpressionException.
#pragma warning disable CS8509
    private static decimal RoundLedgerAmount(decimal amount, string strategy) => strategy switch
    {
        "bankers"  => Math.Round(amount, 2, MidpointRounding.ToEven),
        "half-up"  => Math.Round(amount, 2, MidpointRounding.AwayFromZero),
        "truncate" => Math.Truncate(amount * 100m) / 100m,
    };
#pragma warning restore CS8509

    private static IConsumer<string, byte[]> BuildConsumer(string servers)
    {
        var conf = new ConsumerConfig
        {
            GroupId = $"accounting",
            BootstrapServers = servers,
            // https://github.com/confluentinc/confluent-kafka-dotnet/tree/07de95ed647af80a0db39ce6a8891a630423b952#basic-consumer-example
            AutoOffsetReset = AutoOffsetReset.Earliest,
            EnableAutoCommit = true
        };

        return new ConsumerBuilder<string, byte[]>(conf)
            .Build();
    }

    public void Dispose()
    {
        _isListening = false;
        _consumer?.Dispose();
    }
}
