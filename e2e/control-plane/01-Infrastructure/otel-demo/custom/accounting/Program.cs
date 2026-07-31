// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

using Accounting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

Console.WriteLine("Accounting service started");

Environment.GetEnvironmentVariables()
    .FilterRelevant()
    .OutputInOrder();

var host = Host.CreateDefaultBuilder(args)
    .ConfigureServices(services =>
    {
        services.AddSingleton<Consumer>();
    })
    .Build();

// Initialize the FeatBit native .NET SDK once for the process lifetime. This
// never throws: with no FEATBIT_* env vars (or an unreachable eval-server) the
// accounting flags fall back to safe defaults and the consumer runs as before.
FeatBitFlags.Init(host.Services.GetRequiredService<ILogger<FeatBitFlags>>());
host.Services.GetRequiredService<IHostApplicationLifetime>()
    .ApplicationStopping.Register(FeatBitFlags.Shutdown);

var consumer = host.Services.GetRequiredService<Consumer>();
consumer.StartListening();

host.Run();
