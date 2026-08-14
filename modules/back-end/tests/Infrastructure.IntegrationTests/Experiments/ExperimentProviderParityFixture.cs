using System.Collections.Concurrent;
using Application.Services;
using Application.Users;
using Dapper;
using Domain.EndUsers;
using Domain.Experiments;
using Domain.Targeting;
using Infrastructure.OLAP.ClickHouse;
using Infrastructure.Persistence.EntityFrameworkCore;
using Infrastructure.Persistence.MongoDb;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Npgsql;
using NpgsqlTypes;
using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using Infrastructure.Services.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace Infrastructure.IntegrationTests.Experiments;

public sealed class ExperimentProviderParityFixture : IAsyncLifetime
{
    public static readonly Guid StandardEnvId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    public static readonly Guid UnbalancedEnvId = Guid.Parse("11111111-1111-1111-1111-111111111112");
    public static readonly Guid SamplingEnvId = Guid.Parse("11111111-1111-1111-1111-111111111113");
    public static readonly Guid EnvId = StandardEnvId;
    public const string FlagKey = "checkout-flow";
    public const string MetricEvent = "purchase";
    public const string GuardrailEvent = "checkout_error";

    private readonly ConcurrentDictionary<string, Lazy<Task>> _seedTasks = new();

    private readonly IContainer _postgres = new ContainerBuilder("postgres:15.10")
        .WithEnvironment("POSTGRES_USER", "postgres")
        .WithEnvironment("POSTGRES_PASSWORD", "please_change_me")
        .WithEnvironment("POSTGRES_DB", "featbit")
        .WithPortBinding(5432, true)
        .WithWaitStrategy(Wait.ForUnixContainer().UntilInternalTcpPortIsAvailable(5432))
        .Build();

    private readonly IContainer _mongo = new ContainerBuilder("mongo:5.0.32")
        .WithEnvironment("MONGO_INITDB_ROOT_USERNAME", "admin")
        .WithEnvironment("MONGO_INITDB_ROOT_PASSWORD", "password")
        .WithPortBinding(27017, true)
        .WithWaitStrategy(Wait.ForUnixContainer().UntilInternalTcpPortIsAvailable(27017))
        .Build();

    private readonly IContainer _clickHouse = new ContainerBuilder("clickhouse/clickhouse-server:23.7")
        .WithPortBinding(8123, true)
        .WithWaitStrategy(Wait.ForUnixContainer().UntilInternalTcpPortIsAvailable(8123))
        .Build();

    public async Task InitializeAsync()
    {
        DefaultTypeMap.MatchNamesWithUnderscores = true;

        await Task.WhenAll(
            _postgres.StartAsync(),
            _mongo.StartAsync(),
            _clickHouse.StartAsync()
        );

        await InitializePostgresAsync();
        await InitializeClickHouseAsync();
    }

    public async Task DisposeAsync()
    {
        await Task.WhenAll(
            _postgres.DisposeAsync().AsTask(),
            _mongo.DisposeAsync().AsTask(),
            _clickHouse.DisposeAsync().AsTask()
        );
    }

    public Task SeedScenarioAsync(string provider) =>
        EnsureSeededAsync(provider, "standard", () => SeedScenarioCoreAsync(provider));

    private async Task SeedScenarioCoreAsync(string provider)
    {
        var exposures = Scenario.Exposures;
        var metrics = Scenario.Metrics;
        var users = Scenario.Users;

        await SeedProviderAsync(provider, exposures, metrics, users);
    }

    public Task SeedUnbalancedVariantScenarioAsync(string provider) =>
        EnsureSeededAsync(provider, "unbalanced", () => SeedUnbalancedVariantScenarioCoreAsync(provider));

    private async Task SeedUnbalancedVariantScenarioCoreAsync(string provider)
    {
        var createdAt = DateTimeOffset.Parse("2026-01-01T00:00:00Z");
        var exposures = new List<ScenarioExposure>();
        var metrics = new List<ScenarioMetric>();
        var users = new List<ScenarioUser>();
        var sequence = 1;
        var metricSequence = 1;

        AddUsers("control", "control", count: 900);
        AddUsers("treatment", "treatment", count: 100);

        await SeedProviderAsync(provider, exposures, metrics, users);
        return;

        void AddUsers(string prefix, string variationId, int count)
        {
            for (var i = 1; i <= count; i++)
            {
                var userKey = $"{prefix}-{i:000}";
                var exposedAt = DateTimeOffset.Parse("2026-01-01T01:00:00Z").AddSeconds(sequence);
                users.Add(new ScenarioUser(UnbalancedEnvId, userKey, userKey));
                exposures.Add(new ScenarioExposure(
                    GuidFromSequence(100_000 + sequence++),
                    UnbalancedEnvId,
                    FlagKey,
                    userKey,
                    variationId,
                    variationId,
                    exposedAt,
                    createdAt));
                metrics.Add(new ScenarioMetric(
                    MetricGuidFromSequence(100_000 + metricSequence++),
                    UnbalancedEnvId,
                    userKey,
                    MetricEvent,
                    "CustomEvent",
                    1,
                    exposedAt.AddMinutes(1),
                    createdAt));
            }
        }
    }

    public Task SeedSamplingPlanScenarioAsync(string provider) =>
        EnsureSeededAsync(provider, "sampling", () => SeedSamplingPlanScenarioCoreAsync(provider));

    private async Task SeedSamplingPlanScenarioCoreAsync(string provider)
    {
        var createdAt = DateTimeOffset.Parse("2026-01-01T00:00:00Z");
        var exposures = new List<ScenarioExposure>();
        var metrics = new List<ScenarioMetric>();
        var users = new List<ScenarioUser>();
        var sequence = 1;
        var metricSequence = 1;
        var sampledControl = 0;
        var sampledTreatment = 0;
        var excludedControl = 0;
        var candidate = 1;
        var samplingScope = FlagKey + ":";

        while (sampledControl < 80 || sampledTreatment < 80 || excludedControl < 100)
        {
            var userKey = $"sampling-{candidate++:000000}";
            var controlBucket = DispatchAlgorithm.RolloutOfKey($"{samplingScope}control:{userKey}") * 100;

            if (controlBucket < 11.111111 && sampledControl < 80)
            {
                AddUser(userKey, "control", duplicateExposure: sampledControl < 5);
                sampledControl++;
            }
            else if (sampledTreatment < 80)
            {
                AddUser(userKey, "treatment", duplicateExposure: sampledTreatment < 5);
                sampledTreatment++;
            }
            else if (controlBucket >= 11.111111 && excludedControl < 100)
            {
                AddUser(userKey, "control");
                excludedControl++;
            }
        }

        await SeedProviderAsync(provider, exposures, metrics, users);
        return;

        void AddUser(string userKey, string variationId, bool duplicateExposure = false)
        {
            var exposedAt = DateTimeOffset.Parse("2026-01-01T01:00:00Z").AddSeconds(sequence);
            users.Add(new ScenarioUser(SamplingEnvId, userKey, userKey));

            exposures.Add(new ScenarioExposure(
                GuidFromSequence(200_000 + sequence++),
                SamplingEnvId,
                FlagKey,
                userKey,
                variationId,
                variationId,
                exposedAt,
                createdAt));
            if (duplicateExposure)
            {
                exposures.Add(new ScenarioExposure(
                    GuidFromSequence(200_000 + sequence++),
                    SamplingEnvId,
                    FlagKey,
                    userKey,
                    variationId,
                    variationId,
                    exposedAt.AddMilliseconds(1),
                    createdAt));
            }
            metrics.Add(new ScenarioMetric(
                MetricGuidFromSequence(200_000 + metricSequence++),
                SamplingEnvId,
                userKey,
                MetricEvent,
                "CustomEvent",
                1,
                exposedAt.AddMinutes(-1),
                createdAt));
            metrics.Add(new ScenarioMetric(
                MetricGuidFromSequence(200_000 + metricSequence++),
                SamplingEnvId,
                userKey,
                MetricEvent,
                "CustomEvent",
                1,
                exposedAt.AddMinutes(1),
                createdAt));
            metrics.Add(new ScenarioMetric(
                MetricGuidFromSequence(200_000 + metricSequence++),
                SamplingEnvId,
                userKey,
                MetricEvent,
                "CustomEvent",
                1,
                exposedAt.AddMinutes(2),
                createdAt));
            metrics.Add(new ScenarioMetric(
                MetricGuidFromSequence(200_000 + metricSequence++),
                SamplingEnvId,
                userKey,
                GuardrailEvent,
                "CustomEvent",
                1,
                exposedAt.AddMinutes(3),
                createdAt));
        }
    }

    public IExperimentStatsService CreateExperimentStatsService(string provider) => provider switch
    {
        "Postgres" => new global::Infrastructure.Services.EntityFrameworkCore.ExperimentStatsService(CreateDbContext()),
        "MongoDb" => new global::Infrastructure.Services.MongoDb.ExperimentStatsService(CreateMongoDbClient()),
        "ClickHouse" => new global::Infrastructure.Services.ClickHouse.ExperimentStatsService(CreateClickHouseClient()),
        _ => throw new ArgumentOutOfRangeException(nameof(provider), provider, null)
    };

    public IFeatureFlagInsightsService CreateFeatureFlagInsightsService(string provider) => provider switch
    {
        "Postgres" => new global::Infrastructure.Services.EntityFrameworkCore.ExperimentFeatureFlagInsightsService(CreateDbContext()),
        "MongoDb" => new global::Infrastructure.Services.MongoDb.ExperimentFeatureFlagInsightsService(CreateMongoDbClient()),
        "ClickHouse" => new global::Infrastructure.Services.ClickHouse.ExperimentFeatureFlagInsightsService(CreateClickHouseClient()),
        _ => throw new ArgumentOutOfRangeException(nameof(provider), provider, null)
    };

    public IFeatureFlagEndUserStatsService CreateFeatureFlagEndUserStatsService(string provider) => provider switch
    {
        "Postgres" => new global::Infrastructure.Services.EntityFrameworkCore.ExperimentFeatureFlagEndUserStatsService(CreateDbContext()),
        "MongoDb" => new global::Infrastructure.Services.MongoDb.ExperimentFeatureFlagEndUserStatsService(CreateMongoDbClient()),
        "ClickHouse" => new global::Infrastructure.Services.ClickHouse.ExperimentFeatureFlagEndUserStatsService(CreateClickHouseClient()),
        _ => throw new ArgumentOutOfRangeException(nameof(provider), provider, null)
    };

    public IExperimentMetricService CreateExperimentMetricService(string provider) => provider switch
    {
        "Postgres" => new global::Infrastructure.Services.EntityFrameworkCore.ExperimentMetricService(CreateDbContext()),
        "MongoDb" => new global::Infrastructure.Services.MongoDb.ExperimentMetricService(CreateMongoDbClient()),
        _ => throw new ArgumentOutOfRangeException(nameof(provider), provider, null)
    };

    public (IExperimentService ExperimentService, IExperimentMetricService MetricService)
        CreateExperimentServices(string provider) => provider switch
    {
        "Postgres" => CreatePostgresExperimentServices(),
        "MongoDb" => CreateMongoExperimentServices(),
        _ => throw new ArgumentOutOfRangeException(nameof(provider), provider, null)
    };

    private (IExperimentService ExperimentService, IExperimentMetricService MetricService)
        CreatePostgresExperimentServices()
    {
        var dbContext = CreateDbContext();
        var metricService = new global::Infrastructure.Services.EntityFrameworkCore.ExperimentMetricService(dbContext);
        return (
            new global::Infrastructure.Services.EntityFrameworkCore.ExperimentService(
                dbContext,
                new global::Infrastructure.Services.EntityFrameworkCore.ExperimentStatsService(dbContext),
                new global::Infrastructure.Services.EntityFrameworkCore.FeatureFlagService(
                    dbContext,
                    NullLogger<FeatureFlagService>.Instance),
                metricService,
                new FixtureCurrentUser(),
                new global::Infrastructure.Services.EntityFrameworkCore.UserService(dbContext)),
            metricService);
    }

    private (IExperimentService ExperimentService, IExperimentMetricService MetricService)
        CreateMongoExperimentServices()
    {
        var client = CreateMongoDbClient();
        var metricService = new global::Infrastructure.Services.MongoDb.ExperimentMetricService(client);
        return (
            new global::Infrastructure.Services.MongoDb.ExperimentService(
                client,
                new global::Infrastructure.Services.MongoDb.ExperimentStatsService(client),
                new global::Infrastructure.Services.MongoDb.FeatureFlagService(client),
                metricService,
                new FixtureCurrentUser(),
                new global::Infrastructure.Services.MongoDb.UserService(client)),
            metricService);
    }

    internal AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(PostgresConnectionString)
            .UseSnakeCaseNamingConvention()
            .UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking)
            .Options;

        return new AppDbContext(options);
    }

    private MongoDbClient CreateMongoDbClient()
    {
        return new MongoDbClient(Options.Create(new MongoDbOptions
        {
            ConnectionString = MongoConnectionString,
            Database = "featbit"
        }));
    }

    private ClickHouseClient CreateClickHouseClient(string database = "featbit")
    {
        return new ClickHouseClient(new HttpClient(), Options.Create(new ClickHouseOptions
        {
            HttpEndpoint = ClickHouseHttpEndpoint,
            Database = database,
            User = "default"
        }));
    }

    private string PostgresConnectionString =>
        $"Host=localhost;Port={_postgres.GetMappedPublicPort(5432)};Username=postgres;Password=please_change_me;Database=featbit";

    private string MongoConnectionString =>
        $"mongodb://admin:password@localhost:{_mongo.GetMappedPublicPort(27017)}";

    private string ClickHouseHttpEndpoint =>
        $"http://localhost:{_clickHouse.GetMappedPublicPort(8123)}";

    private async Task InitializePostgresAsync()
    {
        await using var connection = new NpgsqlConnection(PostgresConnectionString);
        await connection.ExecuteAsync("""
            CREATE TABLE IF NOT EXISTS experiment_exposure_events
            (
                id uuid primary key default gen_random_uuid(),
                env_id uuid not null,
                flag_key varchar(256) not null,
                user_key varchar(512) not null,
                variation_id varchar(256) not null,
                variation_value varchar(512) null,
                exposed_at timestamp with time zone not null,
                properties jsonb null,
                created_at timestamp with time zone not null
            );

            CREATE TABLE IF NOT EXISTS experiment_metric_events
            (
                id uuid primary key,
                env_id uuid not null,
                user_key varchar(512) not null,
                event_name varchar(256) not null,
                event_type varchar(64) not null,
                numeric_value double precision not null,
                occurred_at timestamp with time zone not null,
                properties jsonb null,
                created_at timestamp with time zone not null
            );

            CREATE TABLE IF NOT EXISTS experiment_metrics
            (
                id uuid primary key,
                featbit_env_id uuid not null,
                name varchar(256) not null,
                key varchar(128) not null,
                description text null,
                metric_type varchar(64) not null,
                metric_agg varchar(64) not null,
                expected_direction varchar(64) not null,
                status varchar(64) not null,
                created_at timestamp with time zone not null,
                updated_at timestamp with time zone not null
            );

            CREATE TABLE IF NOT EXISTS experiments
            (
                id uuid primary key,
                name varchar(256) not null,
                description text null,
                stage varchar(64) not null,
                flag_key varchar(256) null,
                featbit_project_key varchar(256) null,
                featbit_env_id uuid null,
                hypothesis text null,
                access_token text null,
                change text null,
                constraints text null,
                env_secret text null,
                flag_server_url text null,
                goal text null,
                guardrails text null,
                intent text null,
                last_action text null,
                last_learning text null,
                open_questions text null,
                primary_metric text null,
                sandbox_id text null,
                sandbox_status varchar(64) null,
                variants text null,
                conflict_analysis text null,
                entry_mode varchar(64) null,
                created_at timestamp with time zone not null,
                updated_at timestamp with time zone not null
            );

            CREATE TABLE IF NOT EXISTS experiment_runs
            (
                id uuid primary key,
                experiment_id uuid not null,
                slug varchar(128) not null,
                status varchar(64) not null,
                hypothesis text null,
                method varchar(64) null,
                method_reason text null,
                primary_metric_event varchar(256) null,
                metric_description text null,
                guardrail_events text null,
                guardrail_descriptions text null,
                control_variant varchar(256) null,
                treatment_variant varchar(256) null,
                traffic_allocation text null,
                minimum_sample integer null,
                observation_start timestamp with time zone null,
                observation_end timestamp with time zone null,
                prior_proper boolean not null default false,
                prior_mean double precision null,
                prior_stddev double precision null,
                input_data text null,
                analysis_result text null,
                decision text null,
                decision_summary text null,
                decision_reason text null,
                what_changed text null,
                what_happened text null,
                confirmed_or_refuted text null,
                why_it_happened text null,
                next_hypothesis text null,
                run_id varchar(128) null,
                primary_metric_agg varchar(64) null,
                primary_metric_type varchar(64) null,
                traffic_percent double precision null,
                layer_id varchar(128) null,
                audience_filters text null,
                traffic_offset integer null,
                layer_key varchar(128) null,
                allocation_key_selector varchar(256) null,
                slice_start double precision null,
                slice_end double precision null,
                allocation_plan text null,
                assignment_unit_selector varchar(256) null,
                layer_traffic_percent double precision null,
                analysis_sampling_plan text null,
                data_source_mode varchar(64) null,
                customer_endpoint_config text null,
                created_at timestamp with time zone not null,
                updated_at timestamp with time zone not null
            );

            CREATE TABLE IF NOT EXISTS experiment_activities
            (
                id uuid primary key,
                type varchar(128) not null,
                title varchar(512) not null,
                detail text null,
                actor_id uuid null,
                actor_name varchar(256) null,
                actor_email varchar(512) null,
                actor_type varchar(64) null,
                created_at timestamp with time zone not null,
                experiment_id uuid not null
            );

            CREATE TABLE IF NOT EXISTS end_users
            (
                env_id uuid null,
                key_id varchar(512) not null,
                name varchar(256) not null
            );

            CREATE TABLE IF NOT EXISTS experiment_run_assignments
            (
                id uuid primary key,
                run_id uuid not null,
                env_id uuid not null,
                flag_key varchar(256) not null,
                allocation_key varchar(512) not null,
                assignment_unit varchar(512) not null,
                user_key varchar(512) not null,
                expected_variation_id varchar(256) not null,
                actual_variation_id varchar(256) not null,
                role varchar(64) not null,
                analysis_role varchar(64) not null,
                bucket double precision not null,
                layer_bucket double precision null,
                sampling_bucket double precision null,
                included_by_sampling boolean not null default true,
                exclusion_reason varchar(64) null,
                assigned_at timestamp with time zone not null,
                first_exposed_at timestamp with time zone null,
                created_at timestamp with time zone not null,
                updated_at timestamp with time zone not null
            );

            CREATE UNIQUE INDEX IF NOT EXISTS ix_experiment_run_assignments_run_allocation
                ON experiment_run_assignments (run_id, allocation_key);

            CREATE UNIQUE INDEX IF NOT EXISTS ix_experiment_run_assignments_run_assignment_unit
                ON experiment_run_assignments (run_id, assignment_unit);

            CREATE UNIQUE INDEX IF NOT EXISTS ix_experiment_metrics_env_key
                ON experiment_metrics (featbit_env_id, key);

            CREATE INDEX IF NOT EXISTS ix_experiment_metrics_env_status
                ON experiment_metrics (featbit_env_id, status);

            CREATE INDEX IF NOT EXISTS ix_experiments_env_updated_at
                ON experiments (featbit_env_id, updated_at);

            CREATE INDEX IF NOT EXISTS ix_experiments_featbit_project_key
                ON experiments (featbit_project_key);

            CREATE INDEX IF NOT EXISTS ix_experiments_flag_key
                ON experiments (flag_key);

            CREATE UNIQUE INDEX IF NOT EXISTS ix_experiment_runs_experiment_id_slug
                ON experiment_runs (experiment_id, slug);

            CREATE INDEX IF NOT EXISTS ix_experiment_activities_experiment_id_created_at
                ON experiment_activities (experiment_id, created_at);
            """);
    }

    private async Task InitializeClickHouseAsync()
    {
        var defaultClient = CreateClickHouseClient("default");
        await defaultClient.ExecuteCommandAsync("CREATE DATABASE IF NOT EXISTS featbit");

        var client = CreateClickHouseClient();
        await client.ExecuteCommandAsync("""
            CREATE TABLE IF NOT EXISTS experiment_exposure_events
            (
                id UUID,
                env_id UUID,
                flag_key LowCardinality(String),
                user_key String,
                user_name String,
                variation_id LowCardinality(String),
                variation_value String,
                exposed_at DateTime64(6, 'UTC'),
                properties String,
                created_at DateTime64(6, 'UTC') DEFAULT now64(6)
            )
            ENGINE = MergeTree
            PARTITION BY (env_id, toYYYYMM(exposed_at))
            ORDER BY (env_id, flag_key, exposed_at, cityHash64(user_key))
            SETTINGS index_granularity = 8192
            """);

        await client.ExecuteCommandAsync("""
            CREATE TABLE IF NOT EXISTS experiment_metric_events
            (
                id UUID,
                env_id UUID,
                user_key String,
                user_name String,
                event_name LowCardinality(String),
                event_type LowCardinality(String),
                numeric_value Float64,
                occurred_at DateTime64(6, 'UTC'),
                properties String,
                created_at DateTime64(6, 'UTC') DEFAULT now64(6)
            )
            ENGINE = MergeTree
            PARTITION BY (env_id, toYYYYMM(occurred_at))
            ORDER BY (env_id, event_name, occurred_at, cityHash64(user_key))
            SETTINGS index_granularity = 8192
            """);
    }

    private Task EnsureSeededAsync(string provider, string scenario, Func<Task> seed) =>
        _seedTasks.GetOrAdd(
            $"{provider}:{scenario}",
            _ => new Lazy<Task>(seed, LazyThreadSafetyMode.ExecutionAndPublication)).Value;

    private async Task SeedProviderAsync(
        string provider,
        IReadOnlyCollection<ScenarioExposure> exposures,
        IReadOnlyCollection<ScenarioMetric> metrics,
        IReadOnlyCollection<ScenarioUser> users)
    {
        switch (provider)
        {
            case "Postgres":
                await SeedPostgresAsync(exposures, metrics, users);
                break;
            case "MongoDb":
                await SeedMongoAsync(exposures, metrics, users);
                break;
            case "ClickHouse":
                await SeedClickHouseAsync(exposures, metrics, users);
                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(provider), provider, null);
        }
    }

    private async Task SeedPostgresAsync(
        IEnumerable<ScenarioExposure> exposures,
        IEnumerable<ScenarioMetric> metrics,
        IEnumerable<ScenarioUser> users)
    {
        await using var connection = new NpgsqlConnection(PostgresConnectionString);
        await connection.OpenAsync();
        await using var transaction = await connection.BeginTransactionAsync();

        await CopyExposuresAsync(connection, exposures);
        await CopyMetricsAsync(connection, metrics);
        await CopyUsersAsync(connection, users);

        await transaction.CommitAsync();
    }

    private static async Task CopyExposuresAsync(
        NpgsqlConnection connection,
        IEnumerable<ScenarioExposure> exposures)
    {
        await using var writer = await connection.BeginBinaryImportAsync("""
            COPY experiment_exposure_events
                (id, env_id, flag_key, user_key, variation_id, variation_value, exposed_at, properties, created_at)
            FROM STDIN (FORMAT BINARY)
            """);

        foreach (var exposure in exposures)
        {
            await writer.StartRowAsync();
            await writer.WriteAsync(exposure.Id, NpgsqlDbType.Uuid);
            await writer.WriteAsync(exposure.EnvId, NpgsqlDbType.Uuid);
            await writer.WriteAsync(exposure.FlagKey, NpgsqlDbType.Varchar);
            await writer.WriteAsync(exposure.UserKey, NpgsqlDbType.Varchar);
            await writer.WriteAsync(exposure.VariationId, NpgsqlDbType.Varchar);
            if (exposure.VariationValue is null)
            {
                await writer.WriteNullAsync();
            }
            else
            {
                await writer.WriteAsync(exposure.VariationValue, NpgsqlDbType.Varchar);
            }
            await writer.WriteAsync(exposure.ExposedAt, NpgsqlDbType.TimestampTz);
            await writer.WriteAsync(exposure.Properties, NpgsqlDbType.Jsonb);
            await writer.WriteAsync(exposure.CreatedAt, NpgsqlDbType.TimestampTz);
        }

        await writer.CompleteAsync();
    }

    private static async Task CopyMetricsAsync(
        NpgsqlConnection connection,
        IEnumerable<ScenarioMetric> metrics)
    {
        await using var writer = await connection.BeginBinaryImportAsync("""
            COPY experiment_metric_events
                (id, env_id, user_key, event_name, event_type, numeric_value, occurred_at, properties, created_at)
            FROM STDIN (FORMAT BINARY)
            """);

        foreach (var metric in metrics)
        {
            await writer.StartRowAsync();
            await writer.WriteAsync(metric.Id, NpgsqlDbType.Uuid);
            await writer.WriteAsync(metric.EnvId, NpgsqlDbType.Uuid);
            await writer.WriteAsync(metric.UserKey, NpgsqlDbType.Varchar);
            await writer.WriteAsync(metric.EventName, NpgsqlDbType.Varchar);
            await writer.WriteAsync(metric.EventType, NpgsqlDbType.Varchar);
            await writer.WriteAsync(metric.NumericValue, NpgsqlDbType.Double);
            await writer.WriteAsync(metric.OccurredAt, NpgsqlDbType.TimestampTz);
            await writer.WriteAsync(metric.Properties, NpgsqlDbType.Jsonb);
            await writer.WriteAsync(metric.CreatedAt, NpgsqlDbType.TimestampTz);
        }

        await writer.CompleteAsync();
    }

    private static async Task CopyUsersAsync(
        NpgsqlConnection connection,
        IEnumerable<ScenarioUser> users)
    {
        await using var writer = await connection.BeginBinaryImportAsync("""
            COPY end_users (env_id, key_id, name)
            FROM STDIN (FORMAT BINARY)
            """);

        foreach (var user in users)
        {
            await writer.StartRowAsync();
            await writer.WriteAsync(user.EnvId, NpgsqlDbType.Uuid);
            await writer.WriteAsync(user.KeyId, NpgsqlDbType.Varchar);
            await writer.WriteAsync(user.Name, NpgsqlDbType.Varchar);
        }

        await writer.CompleteAsync();
    }

    private async Task SeedMongoAsync(
        IEnumerable<ScenarioExposure> exposures,
        IEnumerable<ScenarioMetric> metrics,
        IEnumerable<ScenarioUser> users)
    {
        var mongo = CreateMongoDbClient();

        await mongo.CollectionOf<ExperimentExposureEvent>().InsertManyAsync(exposures.Select(x =>
            new ExperimentExposureEvent
            {
                Id = x.Id,
                EnvId = x.EnvId,
                FlagKey = x.FlagKey,
                UserKey = x.UserKey,
                VariationId = x.VariationId,
                VariationValue = x.VariationValue,
                ExposedAt = x.ExposedAt.UtcDateTime,
                Properties = x.Properties,
                CreatedAt = x.CreatedAt.UtcDateTime
            }));

        await mongo.CollectionOf<ExperimentMetricEvent>().InsertManyAsync(metrics.Select(x =>
            new ExperimentMetricEvent
            {
                Id = x.Id,
                EnvId = x.EnvId,
                UserKey = x.UserKey,
                EventName = x.EventName,
                EventType = x.EventType,
                NumericValue = x.NumericValue,
                OccurredAt = x.OccurredAt.UtcDateTime,
                Properties = x.Properties,
                CreatedAt = x.CreatedAt.UtcDateTime
            }));

        await mongo.CollectionOf<EndUser>().InsertManyAsync(users.Select(x =>
            new EndUser(null, x.EnvId, x.KeyId, x.Name, [])
            {
                Id = Guid.NewGuid()
            }));
    }

    private async Task SeedClickHouseAsync(
        IEnumerable<ScenarioExposure> exposures,
        IEnumerable<ScenarioMetric> metrics,
        IEnumerable<ScenarioUser> users)
    {
        var userNames = users.ToDictionary(x => x.KeyId, x => x.Name);
        var clickHouse = CreateClickHouseClient();

        foreach (var chunk in exposures.Chunk(500))
        {
            var values = chunk.Select(exposure =>
            {
                var userName = userNames.GetValueOrDefault(exposure.UserKey, exposure.UserKey);
                return $"""
                    ({ChUuid(exposure.Id)},
                     {ChUuid(exposure.EnvId)},
                     {ChString(exposure.FlagKey)},
                     {ChString(exposure.UserKey)},
                     {ChString(userName)},
                     {ChString(exposure.VariationId)},
                     {ChString(exposure.VariationValue)},
                     {ChDateTime64(exposure.ExposedAt)},
                     {ChString(exposure.Properties)},
                     {ChDateTime64(exposure.CreatedAt)})
                    """;
            });

            await clickHouse.ExecuteCommandAsync($"""
                INSERT INTO experiment_exposure_events
                    (id, env_id, flag_key, user_key, user_name, variation_id, variation_value, exposed_at, properties, created_at)
                VALUES
                    {string.Join(",\n", values)}
                """);
        }

        foreach (var chunk in metrics.Chunk(500))
        {
            var values = chunk.Select(metric =>
            {
                var userName = userNames.GetValueOrDefault(metric.UserKey, metric.UserKey);
                return $"""
                    ({ChUuid(metric.Id)},
                     {ChUuid(metric.EnvId)},
                     {ChString(metric.UserKey)},
                     {ChString(userName)},
                     {ChString(metric.EventName)},
                     {ChString(metric.EventType)},
                     {metric.NumericValue.ToString(System.Globalization.CultureInfo.InvariantCulture)},
                     {ChDateTime64(metric.OccurredAt)},
                     {ChString(metric.Properties)},
                     {ChDateTime64(metric.CreatedAt)})
                    """;
            });

            await clickHouse.ExecuteCommandAsync($"""
                INSERT INTO experiment_metric_events
                    (id, env_id, user_key, user_name, event_name, event_type, numeric_value, occurred_at, properties, created_at)
                VALUES
                    {string.Join(",\n", values)}
                """);
        }
    }

    private static Guid GuidFromSequence(int sequence) =>
        Guid.Parse($"00000000-0000-0000-0000-{sequence:000000000000}");

    private static Guid MetricGuidFromSequence(int sequence) =>
        Guid.Parse($"10000000-0000-0000-0000-{sequence:000000000000}");

    private static string ChString(string value)
    {
        return $"'{value.Replace("\\", "\\\\").Replace("'", "\\'")}'";
    }

    private static string ChUuid(Guid value)
    {
        return $"toUUID('{value}')";
    }

    private static string ChDateTime64(DateTimeOffset value)
    {
        return $"toDateTime64('{value.UtcDateTime:yyyy-MM-dd HH:mm:ss.ffffff}', 6, 'UTC')";
    }

    private static class Scenario
    {
        private static readonly DateTimeOffset CreatedAt = DateTimeOffset.Parse("2026-01-01T00:00:00Z");
        private const int SampleSizePerVariant = 500;

        public static readonly ScenarioUser[] Users = BuildUsers();
        public static readonly ScenarioExposure[] Exposures = BuildExposures();
        public static readonly ScenarioMetric[] Metrics = BuildMetrics();

        private static ScenarioUser[] BuildUsers()
        {
            var users = new List<ScenarioUser>();
            foreach (var prefix in new[] { "a", "b", "c" })
            {
                for (var i = 1; i <= SampleSizePerVariant; i++)
                {
                    users.Add(new ScenarioUser(EnvId, UserKey(prefix, i), $"{prefix.ToUpperInvariant()} User {i:000}"));
                }
            }

            users.Add(new ScenarioUser(EnvId, "other-flag-user", "Other Flag User"));
            return users.ToArray();
        }

        private static ScenarioExposure[] BuildExposures()
        {
            var sequence = 1;
            var exposures = new List<ScenarioExposure>();
            AddVariantExposures(exposures, ref sequence, "a", "A", "control");
            AddVariantExposures(exposures, ref sequence, "b", "B", "treatment");
            AddVariantExposures(exposures, ref sequence, "c", "C", "candidate");
            exposures.Add(new ScenarioExposure(
                GuidFromSequence(900001),
                EnvId,
                "other-flag",
                "other-flag-user",
                "A",
                "control",
                DateTimeOffset.Parse("2026-01-01T01:00:00Z"),
                CreatedAt));

            return exposures.ToArray();
        }

        private static ScenarioMetric[] BuildMetrics()
        {
            var sequence = 1;
            var metrics = new List<ScenarioMetric>();

            AddNoiseMetrics(metrics, ref sequence, "a", 1);
            AddNoiseMetrics(metrics, ref sequence, "b", 1);
            AddNoiseMetrics(metrics, ref sequence, "c", 1);

            for (var i = 1; i <= 250; i++)
            {
                AddMetric(metrics, ref sequence, UserKey("a", i), MetricEvent, 10, ExposureAt(i).AddMinutes(10));
                AddMetric(metrics, ref sequence, UserKey("a", i), MetricEvent, 20, ExposureAt(i).AddMinutes(20));
            }

            for (var i = 1; i <= 300; i++)
            {
                AddMetric(metrics, ref sequence, UserKey("b", i), MetricEvent, 25, ExposureAt(i).AddMinutes(10));
            }

            for (var i = 1; i <= 200; i++)
            {
                AddMetric(metrics, ref sequence, UserKey("c", i), MetricEvent, 1, ExposureAt(i).AddMinutes(10));
                AddMetric(metrics, ref sequence, UserKey("c", i), MetricEvent, 2, ExposureAt(i).AddMinutes(20));
                AddMetric(metrics, ref sequence, UserKey("c", i), MetricEvent, 3, ExposureAt(i).AddMinutes(30));
            }

            return metrics.ToArray();
        }

        private static void AddVariantExposures(
            ICollection<ScenarioExposure> exposures,
            ref int sequence,
            string userPrefix,
            string variationId,
            string variationValue)
        {
            for (var i = 1; i <= SampleSizePerVariant; i++)
            {
                exposures.Add(new ScenarioExposure(
                    GuidFromSequence(sequence++),
                    EnvId,
                    FlagKey,
                    UserKey(userPrefix, i),
                    variationId,
                    variationValue,
                    ExposureAt(i),
                    CreatedAt));
            }
        }

        private static void AddNoiseMetrics(
            ICollection<ScenarioMetric> metrics,
            ref int sequence,
            string userPrefix,
            int userNumber)
        {
            var userKey = UserKey(userPrefix, userNumber);
            var exposedAt = ExposureAt(userNumber);
            AddMetric(metrics, ref sequence, userKey, MetricEvent, 99, exposedAt.AddMinutes(-10));
            AddMetric(metrics, ref sequence, userKey, "refund", 1, exposedAt.AddMinutes(10));
        }

        private static void AddMetric(
            ICollection<ScenarioMetric> metrics,
            ref int sequence,
            string userKey,
            string eventName,
            double numericValue,
            DateTimeOffset occurredAt)
        {
            metrics.Add(new ScenarioMetric(
                MetricGuidFromSequence(sequence++),
                EnvId,
                userKey,
                eventName,
                "CustomEvent",
                numericValue,
                occurredAt,
                CreatedAt));
        }

        private static DateTimeOffset ExposureAt(int userNumber)
        {
            var dayStart = userNumber <= 250
                ? DateTimeOffset.Parse("2026-01-01T01:00:00Z")
                : DateTimeOffset.Parse("2026-01-02T01:00:00Z");
            var indexInDay = (userNumber - 1) % 250;

            return dayStart.AddMinutes(indexInDay);
        }

        private static string UserKey(string prefix, int number) => $"{prefix}-{number:000}";

        private static Guid GuidFromSequence(int sequence) =>
            Guid.Parse($"00000000-0000-0000-0000-{sequence:000000000000}");

        private static Guid MetricGuidFromSequence(int sequence) =>
            Guid.Parse($"10000000-0000-0000-0000-{sequence:000000000000}");
    }

    private sealed class FixtureCurrentUser : ICurrentUser
    {
        public Guid Id => Guid.Empty;
    }

}

public sealed record ScenarioUser(Guid EnvId, string KeyId, string Name);

public sealed record ScenarioExposure(
    Guid Id,
    Guid EnvId,
    string FlagKey,
    string UserKey,
    string VariationId,
    string VariationValue,
    DateTimeOffset ExposedAt,
    DateTimeOffset CreatedAt,
    string Properties = "{}");

public sealed record ScenarioMetric(
    Guid Id,
    Guid EnvId,
    string UserKey,
    string EventName,
    string EventType,
    double NumericValue,
    DateTimeOffset OccurredAt,
    DateTimeOffset CreatedAt,
    string Properties = "{}");
